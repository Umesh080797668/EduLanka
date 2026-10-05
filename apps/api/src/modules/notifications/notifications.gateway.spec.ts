import { JwtService } from '@nestjs/jwt';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { AuthService } from '../auth/auth.service';
import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';

import { NotificationsGateway } from './notifications.gateway';


describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let redisService: jest.Mocked<Partial<RedisService>>;
  let authService: jest.Mocked<Partial<AuthService>>;
  let supabaseService: any;

  beforeEach(async () => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
        decr: jest.fn().mockResolvedValue(0),
      }),
      isTokenRevoked: jest.fn().mockResolvedValue(false),
    };
    authService = {
      isUserActive: jest.fn().mockResolvedValue(true),
    };
    supabaseService = {
      adminClient: {
        channel: jest.fn().mockReturnValue({
          subscribe: jest.fn(),
          send: jest.fn().mockResolvedValue({}),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: RedisService, useValue: redisService },
        { provide: JwtService, useValue: jwtService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    gateway.server = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleBroadcast', () => {
    it('should reject broadcast_notification from unauthenticated client', () => {
      const mockClient: any = {
        id: 'client_anon',
        data: {},
        emit: jest.fn(),
      };

      gateway.handleBroadcast(mockClient, { title: 'Fake Alert', message: 'Hacked' });

      expect(gateway.server.emit).not.toHaveBeenCalled();
      expect(mockClient.emit).toHaveBeenCalledWith('notification_error', {
        message: 'Forbidden: only System Administrators can broadcast notifications.',
      });
    });

    it('should reject broadcast_notification from student, parent, or teacher', () => {
      const mockClient: any = {
        id: 'client_teacher',
        data: { role: 'TEACHER', userId: 'u1' },
        emit: jest.fn(),
      };

      gateway.handleBroadcast(mockClient, { title: 'Fake Alert', message: 'School Closed' });

      expect(gateway.server.emit).not.toHaveBeenCalled();
      expect(mockClient.emit).toHaveBeenCalledWith('notification_error', {
        message: 'Forbidden: only System Administrators can broadcast notifications.',
      });
    });

    it('should allow broadcast_notification from SUPER_ADMIN globally', () => {
      const mockClient: any = {
        id: 'client_admin',
        data: { role: 'SUPER_ADMIN', userId: 'admin_1' },
        emit: jest.fn(),
      };

      gateway.handleBroadcast(mockClient, { title: 'Maintenance', message: 'Platform restart' });

      expect(gateway.server.emit).toHaveBeenCalledWith(
        'system_notification',
        expect.objectContaining({
          title: 'Maintenance',
          message: 'Platform restart',
        })
      );
    });

    it('should allow broadcast_notification from SUPER_ADMIN scoped to a tenant', () => {
      const mockClient: any = {
        id: 'client_admin',
        data: { role: 'SUPER_ADMIN', userId: 'admin_1' },
        emit: jest.fn(),
      };

      const toSpy = jest.spyOn(gateway.server, 'to');

      gateway.handleBroadcast(mockClient, {
        title: 'School Alert',
        message: 'Tenant specific alert',
        tenantId: 'tenant_abc',
      });

      expect(toSpy).toHaveBeenCalledWith('tenant_tenant_abc');
    });
  });
});
