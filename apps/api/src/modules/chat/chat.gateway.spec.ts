import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { RedisService } from '../redis/redis.service';

import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: jest.Mocked<Partial<ChatService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let redisService: jest.Mocked<Partial<RedisService>>;

  beforeEach(async () => {
    chatService = {
      assertParticipantAccess: jest.fn(),
      saveMessage: jest.fn(),
    };
    jwtService = {
      verifyAsync: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
        decr: jest.fn().mockResolvedValue(0),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
      in: jest.fn().mockReturnValue({
        socketsLeave: jest.fn(),
      }),
      socketsLeave: jest.fn(),
      emit: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should authenticate client and join user room without joining tenant room', async () => {
      const mockClient: any = {
        id: 'client_1',
        handshake: { auth: { token: 'valid_jwt' } },
        data: {},
        join: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
      };

      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
        tenantId: 'tenant_123',
        sub: 'user_456',
        role: 'TEACHER',
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.data.tenantId).toBe('tenant_123');
      expect(mockClient.data.userId).toBe('user_456');
      expect(mockClient.data.role).toBe('TEACHER');
      expect(mockClient.join).toHaveBeenCalledWith('user_user_456');
      expect(mockClient.join).not.toHaveBeenCalledWith('tenant_tenant_123');
    });

    it('should disconnect unauthenticated client', async () => {
      const mockClient: any = {
        id: 'client_2',
        handshake: { auth: {} },
        data: {},
        disconnect: jest.fn(),
      };

      await gateway.handleConnection(mockClient);
      expect(mockClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleJoinConversation', () => {
    it('should allow joining conversation room when assertParticipantAccess passes', async () => {
      const mockClient: any = {
        id: 'client_1',
        data: { tenantId: 't1', userId: 'u1', role: 'STUDENT' },
        join: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
      };

      (chatService.assertParticipantAccess as jest.Mock).mockResolvedValue(undefined);

      await gateway.handleJoinConversation(mockClient, { conversationId: 'conv_abc' });

      expect(chatService.assertParticipantAccess).toHaveBeenCalledWith('t1', 'conv_abc', 'u1', 'STUDENT');
      expect(mockClient.join).toHaveBeenCalledWith('conversation_conv_abc');
      expect(mockClient.emit).toHaveBeenCalledWith('joined_conversation', { conversationId: 'conv_abc' });
    });

    it('should deny joining conversation room when assertParticipantAccess throws ForbiddenException', async () => {
      const mockClient: any = {
        id: 'client_1',
        data: { tenantId: 't1', userId: 'u_attacker', role: 'STUDENT' },
        join: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
      };

      (chatService.assertParticipantAccess as jest.Mock).mockRejectedValue(
        new ForbiddenException('You are not a participant in this conversation.')
      );

      await gateway.handleJoinConversation(mockClient, { conversationId: 'conv_private' });

      expect(chatService.assertParticipantAccess).toHaveBeenCalledWith('t1', 'conv_private', 'u_attacker', 'STUDENT');
      expect(mockClient.join).not.toHaveBeenCalledWith('conversation_conv_private');
      expect(mockClient.emit).toHaveBeenCalledWith('chat_error', {
        conversationId: 'conv_private',
        message: 'You are not a participant in this conversation.',
      });
    });
  });

  describe('broadcastMessage', () => {
    it('should deliver new_message strictly to per-conversation room, NOT tenant room', () => {
      const toSpy = jest.spyOn(gateway.server, 'to');
      const message = {
        id: 'msg_1',
        conversation_id: 'conv_abc',
        content: 'Hello private conversation',
      };

      gateway.broadcastMessage('conv_abc', message);

      expect(toSpy).toHaveBeenCalledWith('conversation_conv_abc');
      expect(toSpy).not.toHaveBeenCalledWith(expect.stringMatching(/^tenant_/));
    });
  });

  describe('handleSendMessage', () => {
    it('should save message and broadcast to conversation room', async () => {
      const mockClient: any = {
        id: 'client_1',
        data: { tenantId: 't1', userId: 'u1', role: 'TEACHER' },
        emit: jest.fn(),
      };

      const saved = { id: 'm1', conversation_id: 'conv_1', content: 'test' };
      (chatService.saveMessage as jest.Mock).mockResolvedValue(saved);

      const broadcastSpy = jest.spyOn(gateway, 'broadcastMessage');

      await gateway.handleSendMessage(mockClient, {
        conversationId: 'conv_1',
        content: 'test',
      });

      expect(chatService.saveMessage).toHaveBeenCalledWith('t1', 'conv_1', 'u1', 'test', 'TEACHER');
      expect(broadcastSpy).toHaveBeenCalledWith('conv_1', saved);
    });

    it('should increment metrics:ws:errors on send_message failure', async () => {
      const mockClient: any = {
        id: 'client_1',
        data: { tenantId: 't1', userId: 'u1', role: 'TEACHER' },
        emit: jest.fn(),
      };

      (chatService.saveMessage as jest.Mock).mockRejectedValue(new Error('Rate limit exceeded'));

      await gateway.handleSendMessage(mockClient, {
        conversationId: 'conv_1',
        content: 'test',
      });

      expect((redisService.getClient as jest.Mock)().incr).toHaveBeenCalledWith('metrics:ws:errors');
      expect(mockClient.emit).toHaveBeenCalledWith('send_error', {
        conversationId: 'conv_1',
        message: 'Rate limit exceeded',
      });
    });
  });

  describe('eviction and room management', () => {
    it('should evict specific user active sockets from conversation room', () => {
      gateway.evictUserFromConversation('conv_123', 'user_789');

      expect(gateway.server.in).toHaveBeenCalledWith('user_user_789');
      expect(gateway.server.in('user_user_789').socketsLeave).toHaveBeenCalledWith('conversation_conv_123');
    });

    it('should evict all active sockets from conversation room', () => {
      gateway.evictAllFromConversation('conv_123');

      expect(gateway.server.socketsLeave).toHaveBeenCalledWith('conversation_conv_123');
    });
  });

  describe('broadcastReadReceipt', () => {
    it('should emit message_read event to the conversation room', () => {
      gateway.broadcastReadReceipt('conv_123', 'msg_456', 'user_789');

      expect(gateway.server.to).toHaveBeenCalledWith('conversation_conv_123');
      expect(gateway.server.to('conversation_conv_123').emit).toHaveBeenCalledWith('message_read', {
        conversationId: 'conv_123',
        messageId: 'msg_456',
        userId: 'user_789',
      });
    });
  });

  describe('handleTyping', () => {
    it('should broadcast user_typing to other room participants when socket is in room', () => {
      const mockClient: any = {
        data: { userId: 'user_sender' },
        rooms: new Set(['conversation_conv_123']),
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      };

      gateway.handleTyping(mockClient, { conversationId: 'conv_123', isTyping: true });

      expect(mockClient.to).toHaveBeenCalledWith('conversation_conv_123');
      expect(mockClient.to('conversation_conv_123').emit).toHaveBeenCalledWith('user_typing', {
        conversationId: 'conv_123',
        userId: 'user_sender',
        isTyping: true,
      });
    });

    it('should drop user_typing when socket is not in the conversation room', () => {
      const mockClient: any = {
        data: { userId: 'user_sender' },
        rooms: new Set(),
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      };

      gateway.handleTyping(mockClient, { conversationId: 'conv_123', isTyping: true });

      expect(mockClient.to).not.toHaveBeenCalled();
    });
  });
});
