import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<Partial<ChatService>>;
  let gateway: jest.Mocked<Partial<ChatGateway>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(async () => {
    chatService = {
      saveMessage: jest.fn(),
      removeParticipant: jest.fn().mockResolvedValue({ success: true }),
      markAsRead: jest.fn().mockResolvedValue({ success: true, conversationId: 'conv_123', data: { read_by: ['user_1'] } }),
      deleteConversation: jest.fn().mockResolvedValue({ success: true }),
      leaveConversation: jest.fn().mockResolvedValue({ success: true }),
    };
    gateway = {
      broadcastMessage: jest.fn(),
      broadcastReadReceipt: jest.fn(),
      evictUserFromConversation: jest.fn(),
      evictAllFromConversation: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: ChatService, useValue: chatService },
        { provide: ChatGateway, useValue: gateway },
        { provide: JwtService, useValue: jwtService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should broadcast message to conversation room, not tenant', async () => {
      const mockReq = {
        user: { tenantId: 'tenant_1', sub: 'user_1', role: 'TEACHER' },
      };
      const mockSaved = {
        id: 'msg_99',
        tenant_id: 'tenant_1',
        conversation_id: 'conv_123',
        sender_id: 'user_1',
        content: 'Hello!',
      };

      (chatService.saveMessage as jest.Mock).mockResolvedValue(mockSaved);

      const result = await controller.sendMessage(mockReq, {
        conversationId: 'conv_123',
        content: 'Hello!',
      });

      expect(chatService.saveMessage).toHaveBeenCalledWith(
        'tenant_1',
        'conv_123',
        'user_1',
        'Hello!',
        'TEACHER'
      );
      expect(gateway.broadcastMessage).toHaveBeenCalledWith('conv_123', mockSaved);
      expect(result).toEqual(mockSaved);
    });
  });

  describe('evictions and read receipts', () => {
    const mockReq = {
      user: { tenantId: 'tenant_1', sub: 'user_caller', role: 'MODERATOR' },
    };

    it('should evict removed participant from conversation room', async () => {
      await controller.removeParticipant(mockReq, {
        conversationId: 'conv_123',
        participantUserId: 'user_bad',
      });

      expect(chatService.removeParticipant).toHaveBeenCalledWith('tenant_1', 'conv_123', 'user_bad', 'MODERATOR');
      expect(gateway.evictUserFromConversation).toHaveBeenCalledWith('conv_123', 'user_bad');
    });

    it('should evict caller when leaving conversation', async () => {
      await controller.leaveConversation(mockReq, 'conv_123');

      expect(chatService.leaveConversation).toHaveBeenCalledWith('tenant_1', 'conv_123', 'user_caller');
      expect(gateway.evictUserFromConversation).toHaveBeenCalledWith('conv_123', 'user_caller');
    });

    it('should evict everyone when deleting conversation for everyone', async () => {
      await controller.deleteConversation(mockReq, 'conv_123', 'everyone');

      expect(chatService.deleteConversation).toHaveBeenCalledWith('tenant_1', 'conv_123', 'user_caller', 'everyone');
      expect(gateway.evictAllFromConversation).toHaveBeenCalledWith('conv_123');
    });

    it('should evict caller only when deleting conversation for me', async () => {
      await controller.deleteConversation(mockReq, 'conv_123', 'me');

      expect(chatService.deleteConversation).toHaveBeenCalledWith('tenant_1', 'conv_123', 'user_caller', 'me');
      expect(gateway.evictUserFromConversation).toHaveBeenCalledWith('conv_123', 'user_caller');
    });

    it('should broadcast read receipt when message is marked as read', async () => {
      await controller.markAsRead(mockReq, 'msg_999');

      expect(chatService.markAsRead).toHaveBeenCalledWith('tenant_1', 'msg_999', 'user_caller');
      expect(gateway.broadcastReadReceipt).toHaveBeenCalledWith('conv_123', 'msg_999', 'user_caller');
    });
  });
});
