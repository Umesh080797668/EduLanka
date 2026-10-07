import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
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
            from: jest.fn().mockReturnValue({
                upsert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: { id: 'device-1' }, error: null }),
                eq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
            rpc: jest.fn().mockResolvedValue({
                data: { id: 'event-1', sequence: 1 },
                error: null,
            }),
        };

        mockTenantClient = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
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

    it('should append sync event with tenant scoping', async () => {
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

    it('should fetch disaster pack bundle', async () => {
        const pack = await service.getDisasterPack(caller);
        expect(pack.tenantId).toBe(caller.tenantId);
        expect(pack.status).toBe('DISASTER_PACK_READY');
        expect(pack.emergencyContacts.length).toBeGreaterThan(0);
    });

    it('should trigger disaster push and target active tenant device tokens', async () => {
        const result = await service.triggerDisasterPush({ reason: 'FLOOD' }, caller);
        expect(result.success).toBe(true);
        expect(result.pushPayload.type).toBe('DISASTER_MODE_ACTIVATED');
        expect(result.pushPayload.tenant_id).toBe(caller.tenantId);
    });
});
