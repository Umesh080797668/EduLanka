import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { getQueueToken } from '@nestjs/bullmq';
import { SupabaseService } from '../../supabase/supabase.service';
import { SmsService } from '../../sms/sms.service';
import { MobileDisasterService } from '../mobile-disaster.service';
import { MobilePushService } from '../mobile-push.service';
import { MobileReleaseService } from '../mobile-release.service';
import { MobileSyncService } from '../mobile-sync.service';
import { MobileService } from '../mobile.service';

describe('MobileService', () => {
    let service: MobileService;
    let mockSupabase: any;
    let mockAdminClient: any;
    let mockTenantClient: any;

    const caller: JwtPayload = {
        sub: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
        tenantId: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
        email: 'teacher@royal.lk',
        role: UserRole.TEACHER,
    };

    beforeEach(async () => {
        mockAdminClient = {
            from: jest.fn().mockImplementation((table: string) => {
                const builder: any = {
                    upsert: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    delete: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { id: 'device-1' }, error: null }),
                    maybeSingle: jest.fn().mockImplementation(() => {
                        if (table === 'teachers') {
                            return Promise.resolve({ data: { id: 'teacher-1' }, error: null });
                        }
                        return Promise.resolve({
                            data: {
                                id: caller.tenantId,
                                name: 'Royal College',
                                contact_email: 'info@royal.lk',
                                disaster_mode: true,
                                disaster_reason: 'FLOOD',
                                disaster_resume_date: '2026-10-15T00:00:00.000Z',
                            },
                            error: null,
                        });
                    }),
                    eq: jest.fn().mockReturnThis(),
                    is: jest.fn().mockReturnThis(),
                    gt: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    not: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockImplementation(() => {
                        const p: any = Promise.resolve({
                            data: [
                                {
                                    id: 'ev-1',
                                    tenant_id: caller.tenantId,
                                    entity_type: 'attendance',
                                    entity_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                                    sequence: 1,
                                    payload: {},
                                },
                            ],
                            error: null,
                        });
                        p.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
                        return p;
                    }),
                    then: (resolve: any) => {
                        if (table === 'device_tokens') {
                            return resolve({ data: [{ token: 'fcm-tok-1' }], error: null });
                        }
                        if (table === 'users') {
                            return resolve({ data: [{ phone: '+94771234567' }], error: null });
                        }
                        if (table === 'class_teachers') {
                            return resolve({ data: [{ class_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169' }], error: null });
                        }
                        return resolve({ data: [], error: null });
                    },
                };
                return builder;
            }),
            rpc: jest.fn().mockResolvedValue({
                data: { id: 'event-1', sequence: 1 },
                error: null,
            }),
        };

        mockTenantClient = {
            from: jest.fn().mockImplementation((_table: string) => ({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'notice-1',
                            title: 'Sports Day',
                            content_html: '<p>Annual sports meet</p>',
                            priority: 'NORMAL',
                            created_at: new Date().toISOString(),
                            attachments: [],
                        },
                    ],
                    error: null,
                }),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'pol-1',
                        academic_year: 2026,
                        max_students_per_class: 40,
                        timezone: 'Asia/Colombo',
                        extra_config: { emergency_contacts: [] },
                    },
                    error: null,
                }),
            })),
        };

        mockSupabase = {
            adminClient: mockAdminClient,
            getTenantClient: jest.fn().mockReturnValue(mockTenantClient),
        };

        const mockFcmQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job-1' }),
        };

        const mockSmsService = {
            sendBatchSms: jest.fn().mockResolvedValue([]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MobileSyncService,
                MobilePushService,
                MobileDisasterService,
                MobileReleaseService,
                MobileService,
                { provide: SupabaseService, useValue: mockSupabase },
                { provide: getQueueToken('fcm-push'), useValue: mockFcmQueue },
                { provide: SmsService, useValue: mockSmsService },
            ],
        }).compile();

        service = module.get<MobileService>(MobileService);
        process.env.JWT_SECRET = 'test-jwt-secret-for-signing-tests-32chars!!';
        (MobileService as any).signingKeyPair = undefined;
    });

    afterEach(() => {
        delete process.env.OFFLINE_LICENSE_PRIVATE_KEY;
        (MobileService as any).signingKeyPair = undefined;
    });

    it('should register device token', async () => {
        const result = await service.registerDeviceToken(
            { token: 'fcm-token-123', platform: 'android', deviceModel: 'Pixel 7' },
            caller,
        );
        expect(result.success).toBe(true);
        expect(mockAdminClient.from).toHaveBeenCalledWith('device_tokens');
    });

    it('should append sync event with role check passing for teacher attendance', async () => {
        const result = await service.appendSyncEvent(
            {
                entityType: 'attendance',
                entityId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                eventType: 'CREATED',
                clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                payload: {
                    class_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    student_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    date: '2026-10-12',
                    status: 'PRESENT',
                },
            },
            caller,
        );
        expect(result.success).toBe(true);
        expect(mockAdminClient.rpc).toHaveBeenCalledWith(
            'append_sync_event',
            expect.objectContaining({ p_tenant_id: caller.tenantId }),
        );
    });

    it('should reject teacher attendance sync event when class_id is missing', async () => {
        await expect(
            service.appendSyncEvent(
                {
                    entityType: 'attendance',
                    entityId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    eventType: 'CREATED',
                    clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                    payload: {
                        student_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                        date: '2026-10-12',
                        status: 'PRESENT',
                    },
                },
                caller,
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should reject student appending attendance sync event', async () => {
        const studentCaller: JwtPayload = {
            ...caller,
            role: UserRole.STUDENT,
        };

        await expect(
            service.appendSyncEvent(
                {
                    entityType: 'attendance',
                    entityId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    eventType: 'CREATED',
                    clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                },
                studentCaller,
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should unconditionally reject homework submission forgery even if entityId === caller.sub', async () => {
        const studentCaller: JwtPayload = {
            ...caller,
            sub: '11111111-1111-1111-1111-111111111111',
            role: UserRole.STUDENT,
        };

        // Caller student record has id 'student-record-mine'
        mockAdminClient.from.mockImplementation((table: string) => {
            const builder: any = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockImplementation(() => {
                    if (table === 'students') {
                        return Promise.resolve({
                            data: { id: 'student-record-mine', user_id: studentCaller.sub },
                            error: null,
                        });
                    }
                    return Promise.resolve({ data: null, error: null });
                }),
            };
            return builder;
        });

        // Even though entityId matches caller.sub, student_id is another student's record
        await expect(
            service.appendSyncEvent(
                {
                    entityType: 'homework_submission',
                    entityId: studentCaller.sub,
                    eventType: 'CREATED',
                    clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                    payload: {
                        student_id: '22222222-2222-2222-2222-222222222222', // someone else
                        homework_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    },
                },
                studentCaller,
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject teacher marking attendance for a class not assigned to them', async () => {
        mockAdminClient.from.mockImplementation((table: string) => {
            const builder: any = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockImplementation(() => {
                    if (table === 'teachers') {
                        return Promise.resolve({ data: { id: 'teacher-1' }, error: null });
                    }
                    return Promise.resolve({ data: null, error: null });
                }),
                then: (resolve: any) => {
                    if (table === 'class_teachers') {
                        // Teacher is only assigned to class 'class-A'
                        return resolve({ data: [{ class_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169' }], error: null });
                    }
                    return resolve({ data: [], error: null });
                },
            };
            return builder;
        });

        await expect(
            service.appendSyncEvent(
                {
                    entityType: 'attendance',
                    entityId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    eventType: 'CREATED',
                    clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                    payload: {
                        class_id: '88888888-8888-8888-8888-888888888888', // unassigned class
                        student_id: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                        date: '2026-10-09',
                        status: 'PRESENT',
                    },
                },
                caller,
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject payload exceeding 64KB', async () => {
        const bigPayload = { data: 'x'.repeat(70000) };

        await expect(
            service.appendSyncEvent(
                {
                    entityType: 'attendance',
                    entityId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    eventType: 'CREATED',
                    clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                    payload: bigPayload,
                },
                caller,
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should require OFFLINE_LICENSE_PRIVATE_KEY in production and throw if missing or invalid', async () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        delete process.env.OFFLINE_LICENSE_PRIVATE_KEY;
        (MobileService as any).signingKeyPair = undefined;

        expect(() => (MobileService as any).getSigningKeyPair()).toThrow(
            /OFFLINE_LICENSE_PRIVATE_KEY must be configured in production/,
        );

        // Invalid key in env
        process.env.OFFLINE_LICENSE_PRIVATE_KEY = 'invalid-corrupt-private-key';
        (MobileService as any).signingKeyPair = undefined;
        expect(() => (MobileService as any).getSigningKeyPair()).toThrow(
            /Invalid OFFLINE_LICENSE_PRIVATE_KEY/,
        );

        process.env.NODE_ENV = origEnv;
    });

    it('should issue signed offline entitlement license record', async () => {
        mockAdminClient.from.mockImplementation((table: string) => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: table === 'users'
                    ? { id: caller.sub, is_active: true, role: caller.role, full_name: 'Mr. Perera' }
                    : { id: caller.tenantId, name: 'Royal College', plan: 'GROWTH', status: 'ACTIVE' },
                error: null,
            }),
        }));

        const licenseRes = await service.getOfflineLicense(caller);
        expect(licenseRes.success).toBe(true);
        expect(licenseRes.license.sub).toBe(caller.sub);
        expect(licenseRes.license.tenantId).toBe(caller.tenantId);
        expect(licenseRes.license.plan).toBe('GROWTH');
        expect(licenseRes.license.offlineVideoEnabled).toBe(true);
        expect(licenseRes.signature).toBeDefined();
        expect(licenseRes.publicKey).toBeDefined();
        expect(licenseRes.algorithm).toBe('Ed25519');
        expect(licenseRes.expiresAt).toBeDefined();
    });

    it('should reject non-admin appending entitlement_revocation event', async () => {
        await expect(
            service.appendSyncEvent(
                {
                    entityType: 'entitlement_revocation',
                    entityId: '45f9722b-eda0-453f-88d2-2c9ad06ec169',
                    eventType: 'DELETED',
                    clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                },
                caller, // TEACHER role
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should fetch disaster pack bundle with full blueprint contents', async () => {
        const pack = await service.getDisasterPack(caller);
        expect(pack.tenantId).toBe(caller.tenantId);
        expect(pack.status).toBe('DISASTER_PACK_READY');
        expect(pack.contacts.length).toBeGreaterThan(0);
        expect(pack.notices.length).toBe(1);
        expect(pack.notices[0].content_html).toBe('<p>Annual sports meet</p>');
        expect(pack.closure.isActive).toBe(true);
        expect(pack.closure.reason).toBe('FLOOD');
        expect(Array.isArray(pack.homework)).toBe(true);
        expect(Array.isArray(pack.resources)).toBe(true);
    });

    it('should get sync events with pagination and filtering', async () => {
        const res = await service.getSyncEvents(caller, 0, 10);
        expect(res.tenantId).toBe(caller.tenantId);
        expect(res.events.length).toBe(1);
        expect(res.hasMore).toBe(false);
        expect(res.latestSequence).toBe(1);
    });

    it('should not throw 410 when since = oldest - 1, but throw 410 when since < oldest - 1', async () => {
        // Mock oldestEvent with sequence 10
        mockAdminClient.from.mockImplementation((_table: string) => {
            const builder: any = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                limit: jest.fn().mockImplementation((_num: number) => {
                    const p: any = Promise.resolve({
                        data: [{ id: 'ev-10', sequence: 10, entity_type: 'disaster_mode' }],
                        error: null,
                    });
                    p.maybeSingle = jest.fn().mockResolvedValue({
                        data: { sequence: 10 },
                        error: null,
                    });
                    return p;
                }),
            };
            return builder;
        });

        // Case 1: since = 9 (oldest - 1): NO GAP! Should NOT throw 410!
        const resNoGap = await service.getSyncEvents(caller, 9, 10);
        expect(resNoGap.events).toBeDefined();

        // Case 2: since = 8 (less than oldest - 1): GAP! Must throw 410 GoneException
        await expect(service.getSyncEvents(caller, 8, 10)).rejects.toThrow(
            /Sync sequence predates retention purge window/,
        );
    });

    it('should throw 410 when all sync events purged and client since < last_sequence', async () => {
        mockAdminClient.from.mockImplementation((table: string) => {
            const builder: any = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockImplementation(() => {
                    const p: any = Promise.resolve({ data: [], error: null });
                    // oldestEvent is null (purged)
                    p.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
                    return p;
                }),
                maybeSingle: jest.fn().mockImplementation(() => {
                    if (table === 'tenant_sync_counters') {
                        return Promise.resolve({ data: { last_sequence: 50 }, error: null });
                    }
                    return Promise.resolve({ data: null, error: null });
                }),
            };
            return builder;
        });

        // Client has since = 20, but counter is at 50 and events were purged
        await expect(service.getSyncEvents(caller, 20, 10)).rejects.toThrow(
            /Sync sequence predates retention purge window/,
        );
    });

    it('should trigger disaster push without leaking device tokens', async () => {
        const result = await service.triggerDisasterPush({ reason: 'FLOOD' }, caller);
        expect(result.success).toBe(true);
        expect(result.tenantId).toBe(caller.tenantId);
        expect(result.enqueuedRecipientsCount).toBe(1);
        expect((result as any).tokens).toBeUndefined();
    });

    describe('touchDeviceActivity scoping', () => {
        it('should target specific device by UUID when device ID is provided', async () => {
            const deviceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const eqCalls: any[] = [];
            mockAdminClient.from.mockImplementation((_table: string) => {
                const builder: any = {
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockImplementation((col: string, val: any) => {
                        eqCalls.push([col, val]);
                        return builder;
                    }),
                    then: (resolve: any) => resolve({ data: null, error: null }),
                };
                return builder;
            });

            await service.touchDeviceActivity(caller.tenantId, caller.sub, 42, deviceId);

            expect(eqCalls).toContainEqual(['tenant_id', caller.tenantId]);
            expect(eqCalls).toContainEqual(['user_id', caller.sub]);
            expect(eqCalls).toContainEqual(['is_active', true]);
            expect(eqCalls).toContainEqual(['id', deviceId]);
        });

        it('should target specific device by token when non-UUID token is provided', async () => {
            const token = 'fcm_token_abcdef123456';
            const eqCalls: any[] = [];
            mockAdminClient.from.mockImplementation((_table: string) => {
                const builder: any = {
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockImplementation((col: string, val: any) => {
                        eqCalls.push([col, val]);
                        return builder;
                    }),
                    then: (resolve: any) => resolve({ data: null, error: null }),
                };
                return builder;
            });

            await service.touchDeviceActivity(caller.tenantId, caller.sub, 42, token);

            expect(eqCalls).toContainEqual(['token', token]);
        });

        it('should fallback to strictly the single latest seen active device if device ID is omitted', async () => {
            const latestDeviceId = 'latest-dev-1111-2222-3333-444455556666';
            const eqCalls: any[] = [];
            mockAdminClient.from.mockImplementation((_table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: latestDeviceId }, error: null }),
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockImplementation((col: string, val: any) => {
                        eqCalls.push([col, val]);
                        return builder;
                    }),
                    then: (resolve: any) => resolve({ data: null, error: null }),
                };
                return builder;
            });

            await service.touchDeviceActivity(caller.tenantId, caller.sub, 42);

            expect(eqCalls).toContainEqual(['id', latestDeviceId]);
        });
    });

    describe('chat sync security & catch-up delivery', () => {
        it('should reject offline chat event when sender_id attempts to spoof another user', async () => {
            const studentCaller: JwtPayload = {
                ...caller,
                sub: '11111111-1111-1111-1111-111111111111',
                role: UserRole.STUDENT,
            };

            await expect(
                service.appendSyncEvent(
                    {
                        entityType: 'chat_message',
                        entityId: '33333333-3333-3333-3333-333333333333',
                        eventType: 'CREATED',
                        clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                        payload: {
                            conversation_id: '44444444-4444-4444-4444-444444444444',
                            sender_id: '22222222-2222-2222-2222-222222222222', // spoofed sender
                            content: 'I am someone else',
                        },
                    },
                    studentCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject offline chat event when caller is not an enrolled participant', async () => {
            const convId = '44444444-4444-4444-4444-444444444444';
            const studentCaller: JwtPayload = {
                ...caller,
                sub: '11111111-1111-1111-1111-111111111111',
                role: UserRole.STUDENT,
            };

            mockAdminClient.from.mockImplementation((table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockImplementation(() => {
                        if (table === 'chat_conversations') {
                            return Promise.resolve({ data: { id: convId, tenant_id: caller.tenantId }, error: null });
                        }
                        if (table === 'chat_participants') {
                            // User is NOT a participant
                            return Promise.resolve({ data: null, error: null });
                        }
                        return Promise.resolve({ data: null, error: null });
                    }),
                };
                return builder;
            });

            await expect(
                service.appendSyncEvent(
                    {
                        entityType: 'chat_message',
                        entityId: '33333333-3333-3333-3333-333333333333',
                        eventType: 'CREATED',
                        clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                        payload: {
                            conversation_id: convId,
                            content: 'Intruder message',
                        },
                    },
                    studentCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should deliver chat messages from other participants to offline caller on catch-up sync', async () => {
            const convId = '44444444-4444-4444-4444-444444444444';
            const otherSenderId = '99999999-9999-9999-9999-999999999999';

            mockAdminClient.from.mockImplementation((table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gt: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                    then: (resolve: any) => {
                        if (table === 'sync_events') {
                            return resolve({
                                data: [
                                    {
                                        id: 'ev-1',
                                        sequence: 1,
                                        entity_type: 'chat_message',
                                        payload: {
                                            conversation_id: convId,
                                            sender_id: otherSenderId, // sent by someone else!
                                            content: 'Hello participant!',
                                        },
                                    },
                                ],
                                error: null,
                            });
                        }
                        if (table === 'chat_participants') {
                            // Caller is enrolled in convId
                            return resolve({ data: [{ conversation_id: convId }], error: null });
                        }
                        return resolve({ data: [], error: null });
                    },
                };
                return builder;
            });

            const res = await service.getSyncEvents(caller, 0, 50);
            expect(res.events).toHaveLength(1);
            expect(res.events[0].payload.sender_id).toBe(otherSenderId);
            expect(res.events[0].payload.content).toBe('Hello participant!');
        });
    });

    describe('blog sync security & platform gating', () => {
        it('should reject admin from creating/authoring a blog post via sync outbox', async () => {
            const adminCaller: JwtPayload = {
                ...caller,
                role: UserRole.SCHOOL_ADMIN,
            };

            await expect(
                service.appendSyncEvent(
                    {
                        entityType: 'blog_post',
                        entityId: '33333333-3333-3333-3333-333333333333',
                        eventType: 'CREATED',
                        clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                        payload: {
                            title: 'Admin Post',
                            content_markdown: 'Content',
                            scope: 'SCHOOL',
                        },
                    },
                    adminCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should reject teacher from creating platform blog if tenant is not Growth or above', async () => {
            const starterCaller: JwtPayload = {
                ...caller,
                tenantPlan: 'STARTER',
                role: UserRole.TEACHER,
            };

            await expect(
                service.appendSyncEvent(
                    {
                        entityType: 'blog_post',
                        entityId: '33333333-3333-3333-3333-333333333333',
                        eventType: 'CREATED',
                        clientUuid: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                        payload: {
                            title: 'National Post',
                            content_markdown: 'National Content',
                            scope: 'PLATFORM',
                        },
                    },
                    starterCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should filter out PLATFORM blog sync events for Starter plan callers in getSyncEvents', async () => {
            const starterCaller: JwtPayload = {
                ...caller,
                tenantPlan: 'STARTER',
                role: UserRole.STUDENT,
            };

            mockAdminClient.from.mockImplementation((table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gt: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                    then: (resolve: any) => {
                        if (table === 'sync_events') {
                            return resolve({
                                data: [
                                    {
                                        id: 'ev-platform',
                                        sequence: 1,
                                        entity_type: 'blog_post',
                                        payload: {
                                            title: 'National Masterclass',
                                            scope: 'PLATFORM',
                                        },
                                    },
                                    {
                                        id: 'ev-school',
                                        sequence: 2,
                                        entity_type: 'blog_post',
                                        payload: {
                                            title: 'School Notice Blog',
                                            scope: 'SCHOOL',
                                        },
                                    },
                                ],
                                error: null,
                            });
                        }
                        return resolve({ data: [], error: null });
                    },
                };
                return builder;
            });

            const res = await service.getSyncEvents(starterCaller, 0, 50);
            expect(res.events).toHaveLength(1);
            expect(res.events[0].payload.title).toBe('School Notice Blog');
        });

        it('should allow PLATFORM blog sync events for Growth plan callers in getSyncEvents', async () => {
            const growthCaller: JwtPayload = {
                ...caller,
                tenantPlan: 'GROWTH',
                role: UserRole.STUDENT,
            };

            mockAdminClient.from.mockImplementation((table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gt: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                    then: (resolve: any) => {
                        if (table === 'sync_events') {
                            return resolve({
                                data: [
                                    {
                                        id: 'ev-platform',
                                        sequence: 1,
                                        entity_type: 'blog_post',
                                        payload: {
                                            title: 'National Masterclass',
                                            scope: 'PLATFORM',
                                        },
                                    },
                                    {
                                        id: 'ev-school',
                                        sequence: 2,
                                        entity_type: 'blog_post',
                                        payload: {
                                            title: 'School Notice Blog',
                                            scope: 'SCHOOL',
                                        },
                                    },
                                ],
                                error: null,
                            });
                        }
                        return resolve({ data: [], error: null });
                    },
                };
                return builder;
            });

            const res = await service.getSyncEvents(growthCaller, 0, 50);
            expect(res.events).toHaveLength(2);
        });
    });
});
