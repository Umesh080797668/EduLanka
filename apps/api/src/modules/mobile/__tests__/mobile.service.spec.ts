import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { getQueueToken } from '@nestjs/bullmq';
import { SupabaseService } from '../../supabase/supabase.service';
import { SmsService } from '../../sms/sms.service';
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
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { id: 'device-1' }, error: null }),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: caller.tenantId,
                            name: 'Royal College',
                            contact_email: 'info@royal.lk',
                            disaster_mode: true,
                            disaster_reason: 'FLOOD',
                            disaster_resume_date: '2026-10-15T00:00:00.000Z',
                        },
                        error: null,
                    }),
                    eq: jest.fn().mockReturnThis(),
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
            },
            caller,
        );
        expect(result.success).toBe(true);
        expect(mockAdminClient.rpc).toHaveBeenCalledWith(
            'append_sync_event',
            expect.objectContaining({ p_tenant_id: caller.tenantId }),
        );
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
});
