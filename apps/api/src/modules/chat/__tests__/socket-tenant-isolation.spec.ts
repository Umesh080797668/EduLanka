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

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const shouldRun =
    !!SUPABASE_URL
    && !SUPABASE_URL.includes('yourproject')
    && !SUPABASE_URL.includes('invalid')
    && !!SUPABASE_SERVICE_ROLE_KEY
    && !SUPABASE_SERVICE_ROLE_KEY.includes('invalid');

if (!shouldRun) {
    console.warn('Skipping Socket & Chat Tenant Isolation test: Live Supabase credentials not found in environment');
}

jest.setTimeout(60000);

(shouldRun ? describe : describe.skip)('Socket & Chat Tenant Isolation (Real Database Integration)', () => {
    let gateway: ChatGateway;
    let chatService: ChatService;
    let supabaseService: SupabaseService;

    const TENANT_A = 'a1111111-0000-0000-0000-000000000001';
    const TENANT_B = 'b2222222-0000-0000-0000-000000000002';
    const USER_A = '11111111-aaaa-aaaa-aaaa-111111111111';
    const USER_B = '22222222-bbbb-bbbb-bbbb-222222222222';
    const CONVERSATION_A = '33333333-cccc-cccc-cccc-333333333333';

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

        const admin = supabaseService.adminClient;

        // Clean up previous runs if any
        await admin.from('chat_participants').delete().eq('conversation_id', CONVERSATION_A);
        await admin.from('chat_conversations').delete().eq('id', CONVERSATION_A);
        await admin.from('users').delete().in('id', [USER_A, USER_B]);
        await admin.from('tenants').delete().in('id', [TENANT_A, TENANT_B]);

        // 1. Seed two distinct tenants
        await admin.from('tenants').insert([
            {
                id: TENANT_A,
                name: 'Isolation Test School A',
                slug: 'isolation-school-a',
                plan: 'COMMUNITY',
                status: 'ACTIVE',
                school_type: 'TYPE_2',
                contact_email: 'school_a@test.lk',
            },
            {
                id: TENANT_B,
                name: 'Isolation Test School B',
                slug: 'isolation-school-b',
                plan: 'COMMUNITY',
                status: 'ACTIVE',
                school_type: 'TYPE_2',
                contact_email: 'school_b@test.lk',
            },
        ]);

        // 2. Seed User A in Tenant A and User B in Tenant B
        await admin.from('users').insert([
            {
                id: USER_A,
                tenant_id: TENANT_A,
                email: 'user_a@school_a.lk',
                full_name: 'Student A',
                role: 'STUDENT',
                is_active: true,
            },
            {
                id: USER_B,
                tenant_id: TENANT_B,
                email: 'user_b@school_b.lk',
                full_name: 'Student B',
                role: 'STUDENT',
                is_active: true,
            },
        ]);

        // 3. Seed Conversation in Tenant A
        await admin.from('chat_conversations').insert({
            id: CONVERSATION_A,
            tenant_id: TENANT_A,
            type: 'DIRECT',
            name: 'Direct Conversation A',
        });

        // 4. Enroll User A into Conversation A as participant
        await admin.from('chat_participants').insert({
            tenant_id: TENANT_A,
            conversation_id: CONVERSATION_A,
            user_id: USER_A,
            role: 'MEMBER',
        });
    });

    afterAll(async () => {
        if (!shouldRun || !supabaseService?.adminClient) return;
        const admin = supabaseService.adminClient;
        await admin.from('chat_participants').delete().eq('conversation_id', CONVERSATION_A);
        await admin.from('chat_conversations').delete().eq('id', CONVERSATION_A);
        await admin.from('users').delete().in('id', [USER_A, USER_B]);
        await admin.from('tenants').delete().in('id', [TENANT_A, TENANT_B]);
    });

    describe('Cross-Tenant Room Subscription Defense', () => {
        it('should permit legitimate User A from Tenant A to access their own conversation', async () => {
            // Proves conversation exists and query succeeds for real participant in same tenant
            await expect(
                chatService.assertParticipantAccess(
                    TENANT_A,
                    CONVERSATION_A,
                    USER_A,
                    'STUDENT',
                ),
            ).resolves.not.toThrow();
        });

        it('should strictly reject User B from Tenant B attempting to access Tenant A conversation', async () => {
            // Because getTenantClient(TENANT_B) partitions query with tenant_id = TENANT_B,
            // the participant record in Tenant A is invisible and returns not found
            await expect(
                chatService.assertParticipantAccess(
                    TENANT_B,
                    CONVERSATION_A,
                    USER_B,
                    'STUDENT',
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject a socket from Tenant B joining a conversation in Tenant A', async () => {
            const mockSocketB: any = {
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

            await gateway.handleJoinConversation(mockSocketB, {
                conversationId: CONVERSATION_A,
            });

            // The intruder socket MUST NOT be joined to the conversation room
            expect(mockSocketB.join).not.toHaveBeenCalled();

            // A chat_error event must be emitted notifying the client of rejection
            expect(mockSocketB.emit).toHaveBeenCalledWith(
                'chat_error',
                expect.objectContaining({
                    conversationId: CONVERSATION_A,
                    message: expect.stringMatching(/not a participant/i),
                }),
            );

            // joined_conversation event MUST NOT be emitted
            expect(mockSocketB.emit).not.toHaveBeenCalledWith(
                'joined_conversation',
                expect.anything(),
            );
        });

        it('should allow legitimate socket from Tenant A to join conversation room', async () => {
            const mockSocketA: any = {
                id: 'socket_tenant_a_member',
                data: {
                    tenantId: TENANT_A,
                    userId: USER_A,
                    role: 'STUDENT',
                },
                join: jest.fn(),
                emit: jest.fn(),
                rooms: new Set(),
            };

            await gateway.handleJoinConversation(mockSocketA, {
                conversationId: CONVERSATION_A,
            });

            expect(mockSocketA.join).toHaveBeenCalledWith(`conversation_${CONVERSATION_A}`);
            expect(mockSocketA.emit).toHaveBeenCalledWith(
                'joined_conversation',
                expect.objectContaining({
                    conversationId: CONVERSATION_A,
                }),
            );
        });

        it('should verify typing broadcasts assert strictly on client.to', async () => {
            const roomName = `conversation_${CONVERSATION_A}`;

            // Case A: Socket has not joined the room -> client.to MUST NOT be called
            const mockSocketNotInRoom: any = {
                id: 'socket_not_in_room',
                data: {
                    tenantId: TENANT_A,
                    userId: USER_A,
                },
                rooms: new Set(['socket_not_in_room']),
                to: jest.fn().mockReturnValue({ emit: jest.fn() }),
            };

            gateway.handleTyping(mockSocketNotInRoom, {
                conversationId: CONVERSATION_A,
                isTyping: true,
            });

            expect(mockSocketNotInRoom.to).not.toHaveBeenCalled();

            // Case B: Socket HAS joined the room -> client.to(roomName).emit('user_typing', ...) MUST be called
            const mockEmit = jest.fn();
            const mockSocketInRoom: any = {
                id: 'socket_in_room',
                data: {
                    tenantId: TENANT_A,
                    userId: USER_A,
                },
                rooms: new Set(['socket_in_room', roomName]),
                to: jest.fn().mockReturnValue({ emit: mockEmit }),
            };

            gateway.handleTyping(mockSocketInRoom, {
                conversationId: CONVERSATION_A,
                isTyping: true,
            });

            expect(mockSocketInRoom.to).toHaveBeenCalledWith(roomName);
            expect(mockEmit).toHaveBeenCalledWith('user_typing', {
                userId: USER_A,
                conversationId: CONVERSATION_A,
                isTyping: true,
            });
        });
    });
});
