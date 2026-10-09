import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { SupabaseService } from '../../supabase/supabase.service';
import { UploadService } from '../upload.service';

describe('UploadService', () => {
    let service: UploadService;
    let mockSupabase: any;
    let mockAdminClient: any;
    let mockConfigService: any;
    let mockQueryBuilder: any;

    const TENANT_ID = '45f9722b-eda0-453f-88d2-2c9ad06ec169';
    const PUBLIC_ID = `edulanka/${TENANT_ID}/lesson_intro`;

    beforeEach(async () => {
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockResolvedValue({ error: null }),
            insert: jest.fn().mockResolvedValue({ error: null }),
            then: (resolve: any) => resolve({ data: [{ bytes: 5000000 }], error: null }),
        };

        mockAdminClient = {
            from: jest.fn().mockReturnValue(mockQueryBuilder),
        };

        mockSupabase = {
            adminClient: mockAdminClient,
            getTenantClient: jest.fn().mockReturnValue(mockAdminClient),
        };

        mockConfigService = {
            get: jest.fn().mockImplementation((key: string) => {
                if (key === 'cloudinary.cloudName') return 'test-cloud';
                if (key === 'cloudinary.apiKey') return 'test-key';
                if (key === 'cloudinary.apiSecret') return 'test-secret';
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UploadService,
                { provide: SupabaseService, useValue: mockSupabase },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<UploadService>(UploadService);
    });

    it('should handle deletion webhook and insert deletion_credit with deterministic idempotency key', async () => {
        const payload = {
            notification_type: 'delete',
            public_id: PUBLIC_ID,
            asset_id: 'asset-12345',
            tenant_id: TENANT_ID,
        };

        const result = await service.processCloudinaryWebhook(payload);
        expect(result.success).toBe(true);
        expect(result.deleted).toBe(true);

        expect(mockAdminClient.from).toHaveBeenCalledWith('tenant_storage_ledgers');
        expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenant_id: TENANT_ID,
                resource_type: 'deletion_credit',
                bytes: -5000000,
                idempotency_key: `${PUBLIC_ID}_deletion_asset-12345`,
            }),
            { onConflict: 'tenant_id,idempotency_key' },
        );
    });

    it('should handle deletion webhook with zero existing ledger rows by recording tombstone with deterministic key', async () => {
        // Return 0 existing rows
        mockQueryBuilder.then = (resolve: any) => resolve({ data: [], error: null });

        const payload = {
            notification_type: 'delete',
            public_id: PUBLIC_ID,
            version: '1720000000',
            tenant_id: TENANT_ID,
        };

        const result = await service.processCloudinaryWebhook(payload);
        expect(result.success).toBe(true);
        expect(result.deleted).toBe(true);

        expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                tenant_id: TENANT_ID,
                resource_type: 'deletion_tombstone',
                bytes: 0,
                idempotency_key: `${PUBLIC_ID}_deletion_1720000000`,
            }),
            { onConflict: 'tenant_id,idempotency_key' },
        );
    });

    it('should record master and renditions with deterministic idempotency keys', async () => {
        const payload = {
            notification_type: 'upload',
            public_id: PUBLIC_ID,
            tenant_id: TENANT_ID,
            bytes: 1048576,
            version: 'v2',
            format: 'mp4',
            resource_type: 'video',
            eager: [
                {
                    transformation: 'w_640,h_360',
                    bytes: 524288,
                    format: 'mp4',
                    secure_url: 'https://res.cloudinary.com/test/video/upload/w_640/video.mp4',
                },
            ],
        };

        const result = await service.processCloudinaryWebhook(payload);
        expect(result.success).toBe(true);
        expect(result.renditionsCount).toBe(1);

        expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                resource_type: 'video_master',
                bytes: 1048576,
                idempotency_key: `${PUBLIC_ID}_master_v2`,
            }),
            { onConflict: 'tenant_id,idempotency_key' },
        );

        expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                resource_type: 'video_rendition',
                bytes: 524288,
                idempotency_key: `${PUBLIC_ID}_rendition_w_640,h_360_v2`,
            }),
            { onConflict: 'tenant_id,idempotency_key' },
        );
    });
});
