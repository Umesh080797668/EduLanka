import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
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
                        data: { id: caller.tenantId, name: 'Royal College', contact_email: 'info@royal.lk' },
                        error: null,
                    }),
                    eq: jest.fn().mockReturnThis(),
                    gt: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
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
                    },
                    error: null,
                }),
            })),
        };

        mockSupabase = {
            adminClient: mockAdminClient,
            getTenantClient: jest.fn().mockReturnValue(mockTenantClient),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MobileService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<MobileService>(MobileService);
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

    it('should issue signed offline entitlement license record', async () => {
        // mock user and tenant query
        mockAdminClient.from.mockImplementation((table: string) => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: table === 'users'
                    ? { id: caller.sub, is_active: true, role: caller.role, full_name: 'Mr. Perera' }
                    : { id: caller.tenantId, name: 'Royal College', plan: 'STARTER', status: 'ACTIVE' },
                error: null,
            }),
        }));

        const licenseRes = await service.getOfflineLicense(caller);
        expect(licenseRes.success).toBe(true);
        expect(licenseRes.license.sub).toBe(caller.sub);
        expect(licenseRes.license.tenantId).toBe(caller.tenantId);
        expect(licenseRes.license.plan).toBe('STARTER');
        expect(licenseRes.signature).toBeDefined();
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
        expect(pack.schoolName).toBe('Royal College');
        expect(pack.contacts.length).toBeGreaterThan(0);
        expect(pack.circulars.length).toBe(1);
        expect(pack.circulars[0].content).toBe('<p>Annual sports meet</p>');
        expect(pack.closure).toBeDefined();
        expect(pack.policies.length).toBe(1);
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

    it('should trigger disaster push without leaking targetTokens array', async () => {
        const result = await service.triggerDisasterPush({ reason: 'FLOOD' }, caller);
        expect(result.success).toBe(true);
        expect(result.pushPayload.type).toBe('DISASTER_MODE_ACTIVATED');
        expect(result.pushPayload.tenant_id).toBe(caller.tenantId);
        expect(result.registeredTokensCount).toBe(1);
        expect((result as any).targetTokens).toBeUndefined();
    });
});
