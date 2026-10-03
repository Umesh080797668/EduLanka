import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Twilio } from 'twilio';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { SupabaseService } from '../supabase/supabase.service';

export interface SmsJobPayload {
    to: string;
    message: string;
    tenantId: string;
    noticeId?: string;
    disasterEventId?: string;
    segmentCount?: number;
    twilioSid?: string;
}

@Processor('sms-gateway')
export class SmsProcessor extends WorkerHost {
    private readonly logger = new Logger(SmsProcessor.name);
    private readonly client: Twilio | null = null;
    private readonly fromNumber: string | undefined;
    private readonly senderId: string | undefined;

    constructor(
        private readonly configService: ConfigService<AppConfiguration>,
        private readonly supabaseService: SupabaseService
    ) {
        super();
        const accountSid = this.configService.get('twilio.accountSid', { infer: true });
        const authToken = this.configService.get('twilio.authToken', { infer: true });
        this.fromNumber = this.configService.get('twilio.fromNumber', { infer: true });
        this.senderId = process.env.TWILIO_SENDER_ID || 'EduLanka';

        if (accountSid && authToken && (this.fromNumber || this.senderId)) {
            this.client = new Twilio(accountSid, authToken);
            this.logger.log('Twilio cluster mapped inside SmsWorker processor.');
        }
    }

    async process(job: Job<SmsJobPayload, any, string>): Promise<any> {
        this.logger.log(`Processing SMS Job ${job.id} (attempt ${job.attemptsMade + 1}) targeting ${job.data.to}`);

        const { to, message, tenantId, noticeId, disasterEventId, segmentCount } = job.data;
        const db = this.supabaseService.adminClient;

        if (!this.client) {
            throw new Error('Twilio Credentials Missing. Local emulation disabled per Sprint 4 specifications. Please configure env vars!');
        }

        let sid = job.data.twilioSid;

        try {
            // Idempotency: If this job previously called Twilio successfully and then failed inserting into DB,
            // do NOT call Twilio a second time (prevents duplicate SMS to parent).
            if (!sid) {
                const publicUrl = this.configService.get('app.publicUrl', { infer: true });
                // Use Alphanumeric Sender ID when available; fallback to Twilio fromNumber
                const fromAddress = this.senderId || this.fromNumber;

                const result = await this.client.messages.create({
                    body: message,
                    from: fromAddress,
                    to,
                    statusCallback: `${publicUrl}/api/v1/sms/webhook`
                });

                sid = result.sid;
                // Store sid in job data for idempotency on DB retry
                job.data.twilioSid = sid;
                await job.updateData(job.data);
            }

            // Upsert / insert log entry
            const { error: dbError } = await db.from('sms_logs').upsert({
                tenant_id: tenantId,
                notice_id: noticeId || null,
                disaster_event_id: disasterEventId || null,
                twilio_sid: sid,
                recipient_number: to,
                segment_count: segmentCount || 1,
                status: 'QUEUED'
            }, { onConflict: 'twilio_sid' });

            if (dbError) {
                this.logger.error(`Failed to record SMS log for sid ${sid}: ${dbError.message}`);
                throw new Error(`DB insert failure: ${dbError.message}`);
            }

            return { sid };
        } catch (error: any) {
            this.logger.error(`SMS Worker Failure for Job ${job.id} (attempt ${job.attemptsMade + 1}): ${error.message}`);

            // Only insert a FAILED status row if this is the final attempt or if Twilio already succeeded.
            // Intermediate retries must NOT spam duplicate FAILED rows into sms_logs.
            const maxAttempts = job.opts.attempts || 5;
            const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;

            if (isFinalAttempt && !sid) {
                await db.from('sms_logs').insert({
                    tenant_id: tenantId,
                    notice_id: noticeId || null,
                    disaster_event_id: disasterEventId || null,
                    twilio_sid: `ERR_${job.id}_${Date.now()}`,
                    recipient_number: to,
                    segment_count: segmentCount || 1,
                    status: 'FAILED',
                    error_code: error.code?.toString() || 'TWILIO_API_ERROR'
                });
            }

            // Allow BullMQ to exponentially backtrack
            throw error;
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job) {
        this.logger.error(`BullMQ Node: Twilio Job ${job.id} ultimately failed after all retries.`);
    }
}
