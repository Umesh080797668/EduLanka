import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { Queue } from 'bullmq';

import { calculateSmsSegments } from '../../common/utils/sms-segments';
import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';

import { SmsJobPayload } from './sms.processor';

export interface SendSmsOptions {
    noticeId?: string;
    disasterEventId?: string;
    bypassQuota?: boolean;
    isSafetyCritical?: boolean;
}

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(
        @InjectQueue('sms-gateway') private readonly smsQueue: Queue<SmsJobPayload>,
        private readonly supabaseService: SupabaseService,
        private readonly redisService: RedisService
    ) { }

    /**
     * Send SMS in batch with upfront quota and overage checks, preventing parallel race condition overshoots.
     */
    async sendBatchSms(
        recipients: string[],
        message: string,
        tenantId: string,
        options: SendSmsOptions = {}
    ): Promise<{ success: boolean; queuedCount: number; segmentCount: number; reason?: string }> {
        const uniqueRecipients = [...new Set(recipients.filter((r) => r && r.trim().length > 0))];
        if (uniqueRecipients.length === 0) {
            return { success: true, queuedCount: 0, segmentCount: 0 };
        }

        const segments = calculateSmsSegments(message);
        const totalSegments = uniqueRecipients.length * segments.segmentCount;
        const billingMonth = new Date().toISOString().slice(0, 7);
        const reservationKey = `sms:reserved:${tenantId}:${billingMonth}`;

        // Quota and overage check
        if (!options.bypassQuota) {
            const { data: quota } = await this.supabaseService.adminClient
                .from('tenant_sms_quotas')
                .select('monthly_quota, current_month_usage, plan')
                .eq('tenant_id', tenantId)
                .single();

            if (!quota) {
                throw new ForbiddenException('Tenant quota information not found.');
            }

            if (quota.plan === 'COMMUNITY') {
                throw new ForbiddenException('SMS notifications are strictly unavailable for the Community tier.');
            }

            // Per blueprint §7: Paid tiers include a monthly bundle; usage beyond the bundle is billed as overage.
            // A safety hard ceiling (5x monthly bundle or at least 5000 messages) prevents catastrophic runaway billing.
            const safetyCeiling = Math.max(quota.monthly_quota * 5, 5000);

            // Reserve quota segments in Redis upfront with atomic INCRBY to prevent race conditions
            let newReserved = totalSegments;
            const redis = this.redisService.getClient();
            try {
                newReserved = await redis.incrby(reservationKey, totalSegments);
                // Set 15-minute safety TTL on the reservation key
                if (newReserved === totalSegments) {
                    await redis.expire(reservationKey, 900);
                }
            } catch (err: any) {
                this.logger.warn(`Redis quota reservation increment failed: ${err.message}`);
            }

            const projectedUsage = quota.current_month_usage + newReserved;

            if (projectedUsage > safetyCeiling) {
                // Roll back reservation immediately
                try {
                    await redis.decrby(reservationKey, totalSegments);
                } catch (decrErr) { /* ignore */ }

                this.logger.warn(
                    `SMS batch dispatch blocked for Tenant ${tenantId}: projected usage (${projectedUsage}) exceeds safety ceiling (${safetyCeiling})!`
                );
                return { success: false, queuedCount: 0, segmentCount: segments.segmentCount, reason: 'OVERAGE_HARD_LIMIT_EXCEEDED' };
            }

            if (projectedUsage > quota.monthly_quota) {
                this.logger.log(
                    `Tenant ${tenantId} is operating in billable SMS overage: current ${quota.current_month_usage}, reserved ${newReserved}, quota ${quota.monthly_quota}, adding ${totalSegments} segments.`
                );
            }
        }

        this.logger.log(
            `Enqueuing batch of ${uniqueRecipients.length} SMS (${totalSegments} total segments, encoding ${segments.encoding}) for Tenant ${tenantId}...`
        );

        const jobs = uniqueRecipients.map((to) => ({
            name: 'dispatch-sms',
            data: {
                to,
                message,
                tenantId,
                noticeId: options.noticeId,
                disasterEventId: options.disasterEventId,
                segmentCount: segments.segmentCount,
                reserved: !options.bypassQuota,
            },
            opts: {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 3000,
                },
                removeOnComplete: true,
                removeOnFail: 100,
            },
        }));

        try {
            await this.smsQueue.addBulk(jobs);
        } catch (queueErr: any) {
            if (!options.bypassQuota) {
                try {
                    const redis = this.redisService.getClient();
                    await redis.decrby(reservationKey, totalSegments);
                } catch (decrErr) { /* ignore */ }
            }
            this.logger.error(`Failed to enqueue SMS batch for Tenant ${tenantId}: ${queueErr.message}`);
            throw queueErr;
        }

        return { success: true, queuedCount: uniqueRecipients.length, segmentCount: segments.segmentCount };
    }

    /**
     * Send a single SMS — delegates to sendBatchSms for consistent quota and segment tracking.
     */
    async sendSms(
        to: string,
        message: string,
        tenantId: string,
        noticeIdOrOptions?: string | SendSmsOptions,
        bypassQuota = false
    ) {
        const opts: SendSmsOptions = typeof noticeIdOrOptions === 'object'
            ? noticeIdOrOptions
            : { noticeId: noticeIdOrOptions, bypassQuota };

        const result = await this.sendBatchSms([to], message, tenantId, opts);
        return {
            success: result.success,
            queued: result.queuedCount > 0,
            reason: result.reason,
            segmentCount: result.segmentCount,
        };
    }

    /**
     * Observability: Retrieve live SMS queue depth.
     */
    async getQueueMetrics() {
        const [waiting, active, delayed, failed, completed] = await Promise.all([
            this.smsQueue.getWaitingCount(),
            this.smsQueue.getActiveCount(),
            this.smsQueue.getDelayedCount(),
            this.smsQueue.getFailedCount(),
            this.smsQueue.getCompletedCount(),
        ]);
        return { waiting, active, delayed, failed, completed };
    }
}
