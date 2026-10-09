import * as path from 'path';

import { ForbiddenException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import * as dotenv from 'dotenv';


import { configuration } from '../../../config/configuration';
import { AuthService } from '../../auth/auth.service';
import { RedisService } from '../../redis/redis.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ChatGateway } from '../chat.gateway';
import { ChatService } from '../chat.service';

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

jest.setTimeout(120000);

async function withRetry<T extends { data?: any; error?: any }>(
    fn: () => PromiseLike<T>,
    retries = 3,
    delayMs = 1500,
): Promise<T> {
    let lastResult: T | undefined;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fn();
            if (!res.error || !res.error.message?.includes('fetch failed')) {
                return res;
            }
            lastResult = res;
        } catch (err: any) {
            if (attempt === retries) throw err;
        }
        await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
    return lastResult!;
}

describe('Socket & Chat Tenant Isolation (Real Database Integration)', () => {
    let gateway: ChatGateway;
    let chatService: ChatService;
    let supabaseService: SupabaseService;
    let moduleRef: TestingModule;

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
                {
                    provide: RedisService,
                    useValue: {
                        getClient: () => ({
                            incr: jest.fn().mockResolvedValue(1),
                            decr: jest.fn().mockResolvedValue(0),
                            eval: jest.fn().mockResolvedValue(1),
                            get: jest.fn().mockResolvedValue(null),
                        }),
                    },
                },
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
                {
                    provide: AuthService,
                    useValue: {
                        isUserActive: jest.fn().mockResolvedValue(true),
                    },
                },
            ],
        }).compile();

        moduleRef = module;
        supabaseService = module.get<SupabaseService>(SupabaseService);
        supabaseService.onModuleInit();
        chatService = module.get<ChatService>(ChatService);
        gateway = module.get<ChatGateway>(ChatGateway);

        const admin = supabaseService.adminClient;

        // 1. Seed two distinct tenants
        const tRes = await withRetry(() => admin.from('tenants').upsert([
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
        ], { onConflict: 'id' }));
        if (tRes.error) throw new Error(`Failed to seed tenants: ${tRes.error.message}`);

        // 2. Seed User A in Tenant A and User B in Tenant B
        const uRes = await withRetry(() => admin.from('users').upsert([
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
        ], { onConflict: 'id' }));
        if (uRes.error) throw new Error(`Failed to seed users: ${uRes.error.message}`);

        // 3. Seed Conversation in Tenant A
        const cRes = await withRetry(() => admin.from('chat_conversations').upsert({
            id: CONVERSATION_A,
            tenant_id: TENANT_A,
            type: 'DIRECT',
            name: 'Direct Conversation A',
        }, { onConflict: 'id' }));
        if (cRes.error) throw new Error(`Failed to seed conversation: ${cRes.error.message}`);

        // 4. Enroll User A into Conversation A as participant
        const pRes = await withRetry(() => admin.from('chat_participants').upsert({
            tenant_id: TENANT_A,
            conversation_id: CONVERSATION_A,
            user_id: USER_A,
            role: 'MEMBER',
        }, { onConflict: 'conversation_id,user_id' }));
        if (pRes.error) throw new Error(`Failed to seed participant: ${pRes.error.message}`);
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

    afterAll(async () => {
        const admin = supabaseService?.adminClient;
        if (admin) {
            try { await admin.from('chat_participants').delete().eq('conversation_id', CONVERSATION_A); } catch { /* ignore */ }
            try { await admin.from('chat_conversations').delete().eq('id', CONVERSATION_A); } catch { /* ignore */ }
            try { await admin.from('users').delete().in('id', [USER_A, USER_B]); } catch { /* ignore */ }
            try { await admin.from('tenants').delete().in('id', [TENANT_A, TENANT_B]); } catch { /* ignore */ }
        }
        if (moduleRef) {
            await moduleRef.close().catch(() => { });
        }
    });
});
