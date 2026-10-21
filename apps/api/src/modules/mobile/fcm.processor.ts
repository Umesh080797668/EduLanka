import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

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
    private firebaseInitialized = false;

    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly smsService: SmsService,
    ) {
        super();
        this.initFirebase();
    }

    private initFirebase() {
        if (getApps().length > 0) {
            this.firebaseInitialized = true;
            return;
        }

        const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (saJson) {
            try {
                let raw = saJson.trim();
                if (!raw.startsWith('{') && !raw.startsWith('[')) {
                    try {
                        raw = Buffer.from(raw, 'base64').toString('utf8');
                    } catch (decodeErr) {
                        this.logger.debug(`Could not base64-decode service account string: ${(decodeErr as Error).message}`);
                    }
                }
                const sa = JSON.parse(raw);
                if (sa.private_key && typeof sa.private_key === 'string') {
                    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
                }
                initializeApp({
                    credential: cert(sa),
                });
                this.firebaseInitialized = true;
                this.logger.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT credentials');
            } catch (e: any) {
                this.logger.error(`Failed initializing Firebase with service account JSON: ${e.message}`);
            }
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            try {
                initializeApp();
                this.firebaseInitialized = true;
                this.logger.log('Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS');
            } catch (e: any) {
                this.logger.error(`Failed initializing Firebase via GOOGLE_APPLICATION_CREDENTIALS: ${e.message}`);
            }
        } else {
            this.logger.warn('No Firebase Admin credentials provided. FCM dispatch will run in simulation/fallback mode.');
        }
    }

    async process(job: Job<FcmPushJobPayload>): Promise<any> {
        if (job.name === 'purge-sync-events') {
            this.logger.log('Executing scheduled purge of sync events older than 90 days (ADR-002)...');
            const { data, error } = await this.supabaseService.adminClient.rpc('purge_old_sync_events');
            if (error) {
                this.logger.error(`[CRITICAL_MAINTENANCE_ERROR] Scheduled purge failed: ${error.message}`);
                throw new Error(`Scheduled purge failed: ${error.message}`);
            }
            const count = Number(data) || 0;
            this.logger.log(`Scheduled purge completed: ${count} events deleted.`);
            return { success: true, purgedCount: count };
        }

        const { tenantId, tokens, data, isDisasterMode, smsFallbackMessage, emergencyPhoneNumbers } = job.data;
        this.logger.log(
            `Processing FCM Push Job ${job.id} for tenant ${tenantId}: ${tokens.length} target tokens (isDisasterMode: ${!!isDisasterMode})`,
        );

        // Guard: Skip push execution for suspended tenants (unless disaster emergency)
        if (tenantId && !isDisasterMode) {
            const { data: tenant } = await this.supabaseService.adminClient
                .from('tenants')
                .select('status')
                .eq('id', tenantId)
                .maybeSingle();

            if (tenant && tenant.status !== 'ACTIVE') {
                this.logger.warn(`Skipping FCM Push Job ${job.id}: Tenant ${tenantId} is suspended (status: ${tenant.status}).`);
                return { skipped: true, reason: `Tenant is ${tenant.status}` };
            }
        }

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
            if (this.firebaseInitialized && getApps().length > 0) {
                try {
                    this.logger.log(`Dispatching FCM data-only multicast to ${batch.length} tokens via Firebase Admin...`);
                    const messaging = getMessaging();
                    const response = await messaging.sendEachForMulticast({
                        tokens: batch,
                        data,
                        android: {
                            priority: 'high',
                        },
                        apns: {
                            headers: {
                                'apns-push-type': 'background',
                                'apns-priority': '5',
                            },
                            payload: {
                                aps: {
                                    contentAvailable: true,
                                },
                            },
                        },
                    });

                    dispatchedCount += response.successCount;
                    this.logger.log(`FCM batch result: ${response.successCount} succeeded, ${response.failureCount} failed.`);

                    response.responses.forEach((resp: any, idx: number) => {
                        if (!resp.success) {
                            const errorCode = resp.error?.code;
                            if (
                                errorCode === 'messaging/registration-token-not-registered' ||
                                errorCode === 'messaging/invalid-registration-token'
                            ) {
                                deadTokens.push(batch[idx]);
                            }
                        }
                    });
                } catch (err: any) {
                    this.logger.error(`FCM batch dispatch failed: ${err.message}`);
                    throw err; // Fail loudly so BullMQ retries the batch job
                }
            } else {
                if (process.env.NODE_ENV === 'production') {
                    throw new Error('Firebase Admin credentials missing in production environment. Disaster pushes cannot be delivered.');
                }
                // In local dev/test without credentials, simulate delivery and token acknowledgement
                this.logger.warn(`[Dev Simulation] Dispatched mock FCM push to ${batch.length} tokens for tenant ${tenantId}`);
                dispatchedCount += batch.length;
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
                    { bypassQuota: true, isSafetyCritical: true },
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
