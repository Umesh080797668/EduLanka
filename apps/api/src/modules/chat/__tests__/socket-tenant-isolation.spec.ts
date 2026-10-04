import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ChatGateway } from '../chat.gateway';
import { ChatService } from '../chat.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';
import { configuration } from '../../../config/configuration';

// Load environment variables from api .env file if present
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://yourproject.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'invalid-service-role-key-placeholder-wrong-secret';

jest.setTimeout(15000);

describe('Socket & Chat Tenant Isolation (Real Database Integration)', () => {
    let gateway: ChatGateway;
    let chatService: ChatService;
    let supabaseService: SupabaseService;

    const TENANT_B = 'b2c3d4e5-0000-0000-0000-000000000000';
    const USER_B = '22222222-2222-2222-2222-222222222222';

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [configuration],
                }),
            ],
            providers: [
                SupabaseService,
                RedisService,
                {
                    provide: 'REDIS_CLIENT',
                    useValue: {
                        incr: jest.fn().mockResolvedValue(1),
                        decr: jest.fn().mockResolvedValue(0),
                        eval: jest.fn().mockResolvedValue(1),
                        get: jest.fn().mockResolvedValue(null),
                    },
                },
                ChatService,
                ChatGateway,
                {
                    provide: JwtService,
                    useValue: {
                        verifyAsync: jest.fn(),
                    },
                },
            ],
        }).compile();

        supabaseService = module.get<SupabaseService>(SupabaseService);
        supabaseService.onModuleInit();
        chatService = module.get<ChatService>(ChatService);
        gateway = module.get<ChatGateway>(ChatGateway);
    });

    describe('Cross-Tenant Room Subscription Defense', () => {
        it('should strictly reject a socket from Tenant B joining a conversation in Tenant A', async () => {
            // Emulate conversation ID that belongs to Tenant A
            const conversationIdInTenantA = '33333333-3333-3333-3333-333333333333';

            const mockSocket: any = {
                id: 'socket_tenant_b_intruder',
                data: {
                    tenantId: TENANT_B,
                    userId: USER_B,
                    role: 'STUDENT',
                },
                join: jest.fn(),
                emit: jest.fn(),
                rooms: new Set(),
            };

            await gateway.handleJoinConversation(mockSocket, {
                conversationId: conversationIdInTenantA,
            });

            // The intruder socket MUST NOT be joined to the conversation room
            expect(mockSocket.join).not.toHaveBeenCalled();

            // A chat_error event must be emitted notifying the client of rejection
            expect(mockSocket.emit).toHaveBeenCalledWith(
                'chat_error',
                expect.objectContaining({
                    conversationId: conversationIdInTenantA,
                    message: expect.stringMatching(/not a participant/i),
                }),
            );

            // joined_conversation event MUST NOT be emitted
            expect(mockSocket.emit).not.toHaveBeenCalledWith(
                'joined_conversation',
                expect.anything(),
            );
        });

        it('should prevent cross-tenant message saving via assertParticipant in real database query', async () => {
            const conversationIdInTenantA = '33333333-3333-3333-3333-333333333333';

            // Tenant B client querying Tenant A's conversation
            await expect(
                chatService.assertParticipantAccess(
                    TENANT_B,
                    conversationIdInTenantA,
                    USER_B,
                    'STUDENT',
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject typing broadcasts if socket has not joined the room', async () => {
            const mockSocket: any = {
                id: 'socket_unauthorized',
                data: {
                    tenantId: TENANT_B,
                    userId: USER_B,
                },
                rooms: new Set(['socket_unauthorized']), // only in private socket room
                emit: jest.fn(),
            };

            gateway.server = {
                to: jest.fn().mockReturnValue({ emit: jest.fn() }),
            } as any;

            await gateway.handleTyping(mockSocket, {
                conversationId: '33333333-3333-3333-3333-333333333333',
                isTyping: true,
            });

            // Cannot broadcast typing without room membership
            expect(gateway.server.to).not.toHaveBeenCalled();
        });
    });
});
