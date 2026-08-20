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
}

@Processor('sms-gateway')
export class SmsProcessor extends WorkerHost {
    private readonly logger = new Logger(SmsProcessor.name);
    private readonly client: Twilio | null = null;
    private readonly fromNumber: string | undefined;

    constructor(
        private readonly configService: ConfigService<AppConfiguration>,
        private readonly supabaseService: SupabaseService
    ) {
        super();
        const accountSid = this.configService.get('twilio.accountSid', { infer: true });
        const authToken = this.configService.get('twilio.authToken', { infer: true });
        this.fromNumber = this.configService.get('twilio.fromNumber', { infer: true });

        if (accountSid && authToken && this.fromNumber) {
            this.client = new Twilio(accountSid, authToken);
            this.logger.log('Twilio cluster mapped inside SmsWorker processor.');
        }
    }

    async process(job: Job<SmsJobPayload, any, string>): Promise<any> {
        this.logger.log(`Processing SMS Job ${job.id} targeting ${job.data.to}`);

        const { to, message, tenantId, noticeId } = job.data;
        const db = this.supabaseService.adminClient;

        if (!this.client) {
            throw new Error('Twilio Credentials Missing. Local emulation disabled per Sprint 4 specifications. Please configure env vars!');
        }

        try {
            const publicUrl = this.configService.get('app.publicUrl', { infer: true });
            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to,
                statusCallback: `${publicUrl}/api/v1/sms/webhook`
            });

            // Note: Since this tracks Sent immediately, Webhook handles the Delivery / Failed state modifications globally!
            await db.from('sms_logs').insert({
                tenant_id: tenantId,
                notice_id: noticeId,
                twilio_sid: result.sid,
                recipient_number: to,
                status: 'QUEUED'
            });

            return { sid: result.sid };
        } catch (error: any) {
            this.logger.error(`SMS Worker Twilio Failure: ${error.message}`);

            await db.from('sms_logs').insert({
                tenant_id: tenantId,
                notice_id: noticeId,
                twilio_sid: `ERR_${Date.now()}`,
                recipient_number: to,
                status: 'FAILED',
                error_code: error.code?.toString() || 'TWILIO_API_ERROR'
            });

            // Allow BullMQ to exponentially backtrack
            throw error;
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job) {
        this.logger.error(`BullMQ Node: Twilio Job ${job.id} ultimately failed.`);
    }
}
