import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { SupabaseService } from '../supabase/supabase.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let supabaseService: any;
  let notificationsGateway: any;
  let mockUpsert: jest.Mock;
  let mockUpdate: jest.Mock;

  beforeEach(async () => {
    mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockUpdate = jest
      .fn()
      .mockReturnValue({
        in: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      });

    supabaseService = {
      adminClient: {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'device_tokens') {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  in: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({
                      data: [{ token: 'fcm_token_1' }, { token: 'fcm_token_2' }],
                      error: null,
                    }),
                  }),
                }),
              }),
              upsert: mockUpsert,
              update: mockUpdate,
            };
          }
          return {};
        }),
      },
    };

    notificationsGateway = {
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: NotificationsGateway, useValue: notificationsGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendPushToTokens', () => {
    it('should return 0 counts when token list is empty', async () => {
      const result = await service.sendPushToTokens([], {
        title: 'Test',
        body: 'Empty token test',
      });
      expect(result).toEqual({ dispatchedCount: 0, failureCount: 0, deadTokensCount: 0 });
    });

    it('should dispatch tokens in simulation mode when Firebase is unconfigured in test env', async () => {
      const result = await service.sendPushToTokens(['token_a', 'token_b'], {
        title: 'Emergency Alert',
        body: 'School closure notice',
      });
      expect(result.dispatchedCount).toBe(2);
      expect(result.failureCount).toBe(0);
    });
  });

  describe('sendPushToUsers', () => {
    it('should query device_tokens table and dispatch to users registered tokens', async () => {
      const result = await service.sendPushToUsers('tenant_1', ['user_1', 'user_2'], {
        title: 'Grade Notice',
        body: 'Exam schedule released',
      });

      expect(supabaseService.adminClient.from).toHaveBeenCalledWith('device_tokens');
      expect(result.dispatchedCount).toBe(2);
    });

    it('should return early when userIds array is empty', async () => {
      const result = await service.sendPushToUsers('tenant_1', [], {
        title: 'Notice',
        body: 'Content',
      });
      expect(result.dispatchedCount).toBe(0);
    });
  });

  describe('registerDeviceToken', () => {
    it('should upsert token into device_tokens table', async () => {
      const success = await service.registerDeviceToken(
        'tenant_1',
        'user_1',
        'fcm_token_xyz',
        'android',
        'Pixel 7'
      );

      expect(success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant_1',
          user_id: 'user_1',
          token: 'fcm_token_xyz',
          platform: 'android',
          device_model: 'Pixel 7',
          is_active: true,
        }),
        { onConflict: 'token' }
      );
    });
  });

  describe('broadcastSystemNotification', () => {
    it('should delegate to notificationsGateway.sendNotification', () => {
      service.broadcastSystemNotification({ message: 'Hello' }, 'tenant_1');
      expect(notificationsGateway.sendNotification).toHaveBeenCalledWith(
        { message: 'Hello' },
        'tenant_1'
      );
    });
  });
});
