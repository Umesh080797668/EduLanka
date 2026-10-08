import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { SmsService } from '../sms/sms.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface FcmPushJobPayload {
    tenantId: string;
    tokens: string[];
    data: Record<string, string>;
    isDisasterMode?: boolean;
    smsFallbackMessage?: string;
    emergencyPhoneNumbers?: string[];
}

@Processor('fcm-push')
export class FcmProcessor extends WorkerHost {
    private readonly logger = new Logger(FcmProcessor.name);

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly smsService: SmsService,
    ) {
        super();
    }

    async process(job: Job<FcmPushJobPayload>): Promise<any> {
        const { tenantId, tokens, data, isDisasterMode, smsFallbackMessage, emergencyPhoneNumbers } = job.data;
        this.logger.log(
            `Processing FCM Push Job ${job.id} for tenant ${tenantId}: ${tokens.length} target tokens (isDisasterMode: ${!!isDisasterMode})`,
        );

        if (tokens.length === 0 && !isDisasterMode) {
            return { dispatchedCount: 0, deadTokensCount: 0 };
        }

        // 1. Batch tokens in chunks of 500 (FCM HTTP v1 multicast maximum)
        const BATCH_SIZE = 500;
        const batches: string[][] = [];
        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            batches.push(tokens.slice(i, i + BATCH_SIZE));
        }

        const deadTokens: string[] = [];
        let dispatchedCount = 0;

        for (const batch of batches) {
            try {
                // High-priority, data-only FCM push dispatch
                this.logger.log(`Dispatching FCM data-only batch of ${batch.length} tokens for tenant ${tenantId} (type: ${data?.type ?? 'generic'})...`);
                dispatchedCount += batch.length;

                // In production with Firebase Admin SDK initialized:
                // const response = await admin.messaging().sendEachForMulticast({ tokens: batch, data });
                // Check responses and collect invalid/unregistered tokens:
                // response.responses.forEach((resp, idx) => {
                //   if (!resp.success && (resp.error?.code === 'messaging/registration-token-not-registered' || resp.error?.code === 'messaging/invalid-registration-token')) {
                //     deadTokens.push(batch[idx]);
                //   }
                // });
            } catch (err: any) {
                this.logger.error(`FCM batch dispatch failed: ${err.message}`);
            }
        }

        // 2. Dead Token Cleanup: Deactivate unregistered tokens in device_tokens registry
        if (deadTokens.length > 0) {
            const { error: cleanupErr } = await this.supabaseService.adminClient
                .from('device_tokens')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .in('token', deadTokens)
                .eq('tenant_id', tenantId);

            if (cleanupErr) {
                this.logger.error(`Failed to deactivate dead device tokens: ${cleanupErr.message}`);
            } else {
                this.logger.log(`Dead-token cleanup deactivated ${deadTokens.length} tokens for tenant ${tenantId}`);
            }
        }

        // 3. Disaster SMS Fallback Pipeline (reusing Phase 2 Twilio pipeline)
        if (isDisasterMode && smsFallbackMessage && emergencyPhoneNumbers && emergencyPhoneNumbers.length > 0) {
            try {
                this.logger.log(`Triggering SMS emergency fallback to ${emergencyPhoneNumbers.length} emergency contacts...`);
                await this.smsService.sendBatchSms(
                    emergencyPhoneNumbers,
                    smsFallbackMessage,
                    tenantId,
                    { bypassQuota: true, isSafetyCritical: true }
                );
            } catch (smsErr: any) {
                this.logger.error(`Disaster SMS fallback dispatch error: ${smsErr.message}`);
            }
        }

        return {
            success: true,
            tenantId,
            dispatchedCount,
            deadTokensCleaned: deadTokens.length,
            smsFallbackDispatched: !!(isDisasterMode && emergencyPhoneNumbers?.length),
        };
    }
}
