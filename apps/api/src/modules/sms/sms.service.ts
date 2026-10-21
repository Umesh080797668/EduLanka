import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  ForbiddenException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { AppConfiguration } from '../../config/configuration';
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

const ATOMIC_RESERVATION_LUA = `
    local key = KEYS[1]
    local totalSegments = tonumber(ARGV[1])
    local safetyCeiling = tonumber(ARGV[2])
    local currentDbUsage = tonumber(ARGV[3])
    local bypassQuota = tonumber(ARGV[4])

    local reserved = redis.call('get', key)
    local currentReserved = 0
    if reserved then
        currentReserved = tonumber(reserved)
    end

    local projected = currentDbUsage + currentReserved + totalSegments

    if bypassQuota == 0 and projected > safetyCeiling then
        return -1
    end

    local newReserved = redis.call('incrby', key, totalSegments)
    redis.call('expire', key, 1800)
    return newReserved
`;

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectQueue('sms-gateway') private readonly smsQueue: Queue<SmsJobPayload>,
    private readonly supabaseService: SupabaseService,
    private readonly redisService: RedisService,
    @Optional() private readonly configService?: ConfigService<AppConfiguration>
  ) {}

  /**
   * Check if carrier credentials (Twilio) are present in the environment.
   */
  isTwilioConfigured(): boolean {
    const accountSid =
      this.configService?.get('twilio.accountSid', { infer: true }) ||
      process.env.TWILIO_ACCOUNT_SID;
    const authToken =
      this.configService?.get('twilio.authToken', { infer: true }) || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber =
      this.configService?.get('twilio.fromNumber', { infer: true }) ||
      process.env.TWILIO_FROM_NUMBER;
    const senderId =
      this.configService?.get('twilio.senderId', { infer: true }) || process.env.TWILIO_SENDER_ID;
    return Boolean(accountSid && authToken && (fromNumber || senderId));
  }

  /**
   * Send SMS in batch with atomic upfront quota and overage checks, preventing parallel race condition overshoots.
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

    // Verify Twilio configuration upfront; surface configuration error instead of mock success
    if (!this.isTwilioConfigured()) {
      throw new ServiceUnavailableException(
        'Twilio SMS service is unconfigured. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_SENDER_ID.'
      );
    }

    const segments = calculateSmsSegments(message);
    const totalSegments = uniqueRecipients.length * segments.segmentCount;
    const billingMonth = new Date().toISOString().slice(0, 7);
    const reservationKey = `sms:reserved:${tenantId}:${billingMonth}`;
    const redis = this.redisService.getClient();

    // Policy check: Verify sms_enabled unless safety-critical disaster emergency
    if (!options.isSafetyCritical && !options.disasterEventId) {
      const { data: policy } = await this.supabaseService.adminClient
        .from('school_policy')
        .select('sms_enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (policy && policy.sms_enabled === false) {
        this.logger.warn(
          `SMS batch dispatch blocked for Tenant ${tenantId}: SMS notifications are disabled by school policy.`
        );
        return {
          success: false,
          queuedCount: 0,
          segmentCount: segments.segmentCount,
          reason: 'SMS_DISABLED_BY_SCHOOL_POLICY',
        };
      }
    }

    // Atomic Quota and Overage Deduction via Redis Lua
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
        throw new ForbiddenException(
          'SMS notifications are strictly unavailable for the Community tier.'
        );
      }

      // Safety hard ceiling: 5x monthly bundle or at least 5000 segments
      const safetyCeiling = Math.max(quota.monthly_quota * 5, 5000);
      const currentDbUsage = Number(quota.current_month_usage) || 0;

      let reservationResult: number;
      try {
        reservationResult = Number(
          await redis.eval(
            ATOMIC_RESERVATION_LUA,
            1,
            reservationKey,
            totalSegments,
            safetyCeiling,
            currentDbUsage,
            0
          )
        );
      } catch (err: any) {
        this.logger.warn(`Redis atomic quota reservation failed: ${err.message}`);
        reservationResult = totalSegments;
      }

      if (reservationResult === -1) {
        this.logger.warn(
          `SMS batch dispatch blocked for Tenant ${tenantId}: projected usage exceeds safety ceiling (${safetyCeiling}) under atomic lock!`
        );
        return {
          success: false,
          queuedCount: 0,
          segmentCount: segments.segmentCount,
          reason: 'OVERAGE_HARD_LIMIT_EXCEEDED',
        };
      }

      if (reservationResult > quota.monthly_quota) {
        this.logger.log(
          `Tenant ${tenantId} is operating in billable SMS overage: monthly quota ${quota.monthly_quota}, committed segments ${reservationResult}.`
        );
      }
    } else {
      // Disaster Mode / Emergency blasts: atomically commit reserved counter so concurrent traffic sees usage
      try {
        await redis.eval(
          ATOMIC_RESERVATION_LUA,
          1,
          reservationKey,
          totalSegments,
          0,
          0,
          1 // bypassQuota = 1
        );
      } catch (err: any) {
        this.logger.warn(`Redis disaster reservation tracking failed: ${err.message}`);
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
        } catch (decrErr) {
          /* ignore */
        }
      }
      this.logger.error(`Failed to enqueue SMS batch for Tenant ${tenantId}: ${queueErr.message}`);
      throw queueErr;
    }

    return {
      success: true,
      queuedCount: uniqueRecipients.length,
      segmentCount: segments.segmentCount,
    };
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
    const opts: SendSmsOptions =
      typeof noticeIdOrOptions === 'object'
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
