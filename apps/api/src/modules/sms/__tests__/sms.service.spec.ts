import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { SmsService } from '../sms.service';
import { RedisService } from '../../redis/redis.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('SmsService', () => {
  let service: SmsService;
  let mockQueue: any;
  let mockRedis: any;
  let mockSupabase: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockQueue = {
      addBulk: jest.fn().mockResolvedValue([]),
      getWaitingCount: jest.fn().mockResolvedValue(0),
      getActiveCount: jest.fn().mockResolvedValue(0),
      getDelayedCount: jest.fn().mockResolvedValue(0),
      getFailedCount: jest.fn().mockResolvedValue(0),
      getCompletedCount: jest.fn().mockResolvedValue(0),
    };

    mockRedis = {
      getClient: jest.fn().mockReturnValue({
        eval: jest.fn().mockResolvedValue(10), // returns newReserved
        incrby: jest.fn().mockResolvedValue(10),
        decrby: jest.fn().mockResolvedValue(0),
        expire: jest.fn().mockResolvedValue(1),
      }),
    };

    mockSupabase = {
      adminClient: {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'school_policy') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { sms_enabled: true },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'tenant_sms_quotas') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: {
                      monthly_quota: 500,
                      current_month_usage: 100,
                      plan: 'STARTER',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      },
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'twilio.accountSid') return 'AC_test_account_sid';
        if (key === 'twilio.authToken') return 'test_auth_token';
        if (key === 'twilio.fromNumber') return '+15555555555';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: getQueueToken('sms-gateway'), useValue: mockQueue },
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Twilio configuration enforcement', () => {
    it('should detect when Twilio is configured', () => {
      expect(service.isTwilioConfigured()).toBe(true);
    });

    it('should detect when Twilio is unconfigured', () => {
      const unconfiguredConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };
      const unconfiguredService = new SmsService(
        mockQueue,
        mockSupabase,
        mockRedis,
        unconfiguredConfigService as any
      );
      expect(unconfiguredService.isTwilioConfigured()).toBe(false);
    });

    it('should surface configuration error when sendSms is called without Twilio credentials', async () => {
      const unconfiguredConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };
      const unconfiguredService = new SmsService(
        mockQueue,
        mockSupabase,
        mockRedis,
        unconfiguredConfigService as any
      );

      await expect(
        unconfiguredService.sendSms('+94771234567', 'Test Alert', 'tenant_1')
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('Atomic Quota Reservation', () => {
    it('should atomically reserve quota via Redis Lua script and enqueue jobs', async () => {
      const result = await service.sendBatchSms(
        ['+94771111111', '+94772222222'],
        'School closure alert',
        'tenant_1'
      );

      expect(result.success).toBe(true);
      expect(result.queuedCount).toBe(2);
      expect(mockRedis.getClient().eval).toHaveBeenCalled();
      expect(mockQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'dispatch-sms',
            data: expect.objectContaining({
              to: '+94771111111',
              tenantId: 'tenant_1',
            }),
          }),
        ])
      );
    });

    it('should reject immediately when Redis atomic reservation returns -1 (hard limit exceeded)', async () => {
      mockRedis.getClient().eval.mockResolvedValueOnce(-1);

      const result = await service.sendBatchSms(['+94771111111'], 'Burst SMS request', 'tenant_1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('OVERAGE_HARD_LIMIT_EXCEEDED');
      expect(mockQueue.addBulk).not.toHaveBeenCalled();
    });

    it('should forbid Community tier tenants from dispatching SMS', async () => {
      mockSupabase.adminClient.from.mockImplementation((table: string) => {
        if (table === 'school_policy') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { sms_enabled: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'tenant_sms_quotas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    monthly_quota: 0,
                    current_month_usage: 0,
                    plan: 'COMMUNITY',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.sendBatchSms(['+94771111111'], 'Notice', 'tenant_community')
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Disaster Mode blast with bypassQuota=true and still track reservation', async () => {
      const result = await service.sendBatchSms(
        ['+94771111111', '+94772222222'],
        '[EMERGENCY] Cyclone Alert',
        'tenant_1',
        {
          bypassQuota: true,
          isSafetyCritical: true,
          disasterEventId: 'event_123',
        }
      );

      expect(result.success).toBe(true);
      expect(result.queuedCount).toBe(2);
      expect(mockRedis.getClient().eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        expect.stringContaining('sms:reserved:tenant_1'),
        expect.any(Number),
        0,
        0,
        1 // bypassQuota = 1
      );
    });
  });
});
