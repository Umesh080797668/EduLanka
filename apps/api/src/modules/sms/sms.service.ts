import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SmsJobPayload } from './sms.processor';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(
        @InjectQueue('sms-gateway') private readonly smsQueue: Queue<SmsJobPayload>,
        private readonly supabaseService: SupabaseService
    ) { }

    async sendSms(to: string, message: string, tenantId: string, noticeId?: string, bypassQuota = false) {
        // Enforce Quota constraints dynamically avoiding database lockouts!
        if (!bypassQuota) {
            const { data: quota } = await this.supabaseService.adminClient
                .from('tenant_sms_quotas')
                .select('monthly_quota, current_month_usage, plan')
                .eq('tenant_id', tenantId)
                .single();

            if (quota && quota.plan !== 'COMMUNITY') {
                if (quota.current_month_usage >= quota.monthly_quota) {
                    this.logger.warn(`SMS dispatch blocked for Tenant ${tenantId} due to hard quota limits!`);
                    return { success: false, queued: false, reason: 'QUOTA_EXCEEDED' };
                }
            }
        }

        this.logger.log(`Dispatching Queue worker to ${to}...`);

        await this.smsQueue.add('dispatch-sms', { to, message, tenantId, noticeId }, {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 3000
            },
            removeOnComplete: true,
            removeOnFail: 100 // retain last 100 queue logs max!
        });

        return { success: true, queued: true };
    }
}
