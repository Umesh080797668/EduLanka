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
    };
    gateway = {
      broadcastMessage: jest.fn(),
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
});
