import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Twilio } from 'twilio';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

export interface SmsJobPayload {
    to: string;
    message: string;
    tenantId: string;
    noticeId?: string;
    disasterEventId?: string;
    segmentCount?: number;
    twilioSid?: string;
    reserved?: boolean;
}

@Processor('sms-gateway')
export class SmsProcessor extends WorkerHost {
    private readonly logger = new Logger(SmsProcessor.name);
    private readonly client: Twilio | null = null;
    private readonly fromNumber: string | undefined;
    private readonly senderId: string | undefined;

    constructor(
        private readonly configService: ConfigService<AppConfiguration>,
        private readonly supabaseService: SupabaseService,
        private readonly redisService: RedisService
    ) {
        super();
        const accountSid = this.configService.get('twilio.accountSid', { infer: true });
        const authToken = this.configService.get('twilio.authToken', { infer: true });
        this.fromNumber = this.configService.get('twilio.fromNumber', { infer: true });
        this.senderId = this.configService.get('twilio.senderId', { infer: true }) || process.env.TWILIO_SENDER_ID || undefined;

        if (accountSid && authToken && (this.fromNumber || this.senderId)) {
            this.client = new Twilio(accountSid, authToken);
            this.logger.log('Twilio cluster mapped inside SmsWorker processor.');
        }
    }

    async process(job: Job<SmsJobPayload, any, string>): Promise<any> {
        this.logger.log(`Processing SMS Job ${job.id} (attempt ${job.attemptsMade + 1}) targeting ${job.data.to}`);

        const { to, message, tenantId, noticeId, disasterEventId, segmentCount, reserved } = job.data;
        const db = this.supabaseService.adminClient;

        if (!this.client) {
            throw new Error('Twilio Credentials Missing. Local emulation disabled per Sprint 4 specifications. Please configure env vars!');
        }

        let sid = job.data.twilioSid;

        try {
            // Idempotency: If this job previously called Twilio successfully and then failed inserting into DB,
            // do NOT call Twilio a second time (prevents duplicate SMS to parent).
            if (!sid) {
                const webhookUrl = this.configService.get('twilio.webhookUrl', { infer: true })
                    || `${this.configService.get('app.publicUrl', { infer: true })}/api/v1/sms/webhook`;
                // Use Alphanumeric Sender ID only when explicitly configured; otherwise fallback to fromNumber
                const fromAddress = this.senderId || this.fromNumber;

                if (!fromAddress) {
                    throw new Error('Neither TWILIO_FROM_NUMBER nor TWILIO_SENDER_ID is configured.');
                }

                const result = await this.client.messages.create({
                    body: message,
                    from: fromAddress,
                    to,
                    statusCallback: webhookUrl,
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

            // Release quota reservation now that this SMS is recorded in the DB usage view (only if quota was reserved)
            if (reserved) {
                await this.releaseQuotaReservation(tenantId, segmentCount);
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
                // Release reservation on permanent failure (only if quota was reserved)
                if (reserved) {
                    await this.releaseQuotaReservation(tenantId, segmentCount);
                }
            }

            // Allow BullMQ to exponentially backtrack
            throw error;
        }
    }

    private async releaseQuotaReservation(tenantId: string, segmentCount?: number) {
        try {
            const billingMonth = new Date().toISOString().slice(0, 7);
            const reservationKey = `sms:reserved:${tenantId}:${billingMonth}`;
            const segmentsToRelease = segmentCount || 1;
            const RELEASE_LUA = `
                local current = redis.call('get', KEYS[1])
                if current and tonumber(current) > 0 then
                    local newval = math.max(0, tonumber(current) - tonumber(ARGV[1]))
                    redis.call('set', KEYS[1], newval)
                    return newval
                end
                return 0
            `;
            await this.redisService.getClient().eval(RELEASE_LUA, 1, reservationKey, segmentsToRelease);
        } catch (err: any) {
            this.logger.warn(`Failed to release quota reservation for tenant ${tenantId}: ${err.message}`);
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job) {
        this.logger.error(`BullMQ Node: Twilio Job ${job.id} ultimately failed after all retries.`);
    }
}
