import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('ChatService', () => {
  let service: ChatService;
  let supabaseService: any;
  let mockTenantClient: any;
  let redisService: any;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockTenantClient = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'msg-1', content: 'hello' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'part-1' }, error: null }),
    };

    supabaseService = {
      getTenantClient: jest.fn().mockReturnValue(mockTenantClient),
      adminClient: mockTenantClient,
    };

    mockRedisClient = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    redisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: SupabaseService, useValue: supabaseService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveMessage', () => {
    it('should reject empty or whitespace message content', async () => {
      await expect(
        service.saveMessage('tenant-1', 'conv-1', 'user-1', '   ', UserRole.STUDENT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject message content exceeding 4000 characters', async () => {
      const longMessage = 'a'.repeat(4001);
      await expect(
        service.saveMessage('tenant-1', 'conv-1', 'user-1', longMessage, UserRole.STUDENT)
      ).rejects.toThrow(BadRequestException);
    });

    it('should save valid message for verified participant', async () => {
      const result = await service.saveMessage(
        'tenant-1',
        'conv-1',
        'user-1',
        'Valid test message',
        UserRole.STUDENT
      );
      expect(result).toBeDefined();
      expect(mockTenantClient.insert).toHaveBeenCalledWith({
        tenant_id: 'tenant-1',
        conversation_id: 'conv-1',
        sender_id: 'user-1',
        content: 'Valid test message',
      });
    });

    it('should reject message when rate limit is exceeded (> 5 messages in 3s)', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(6);

      await expect(
        service.saveMessage('tenant-1', 'conv-1', 'user-1', 'Rapid message', UserRole.STUDENT)
      ).rejects.toThrow(BadRequestException);
    });
  });
});
