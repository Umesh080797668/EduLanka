import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    ForbiddenException,
    PayloadTooLargeException,
} from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { MediaService, isAllowedMediaUrl } from '../media.service';

describe('MediaService', () => {
    let service: MediaService;
    let mockSupabase: any;
    let mockAdminClient: any;

    const teacherGrowth: JwtPayload = {
        sub: '11111111-1111-1111-1111-111111111111',
        tenantId: '22222222-2222-2222-2222-222222222222',
        email: 'teacher@growth.lk',
        role: UserRole.TEACHER,
        tenantPlan: 'GROWTH',
    };

    const teacherCommunity: JwtPayload = {
        sub: '33333333-3333-3333-3333-333333333333',
        tenantId: '22222222-2222-2222-2222-222222222222',
        email: 'teacher@community.lk',
        role: UserRole.TEACHER,
        tenantPlan: 'COMMUNITY',
    };

    const studentGrowth: JwtPayload = {
        sub: '44444444-4444-4444-4444-444444444444',
        tenantId: '22222222-2222-2222-2222-222222222222',
        email: 'student@growth.lk',
        role: UserRole.STUDENT,
        tenantPlan: 'GROWTH',
    };

    const studentStarter: JwtPayload = {
        sub: '55555555-5555-5555-5555-555555555555',
        tenantId: '22222222-2222-2222-2222-222222222222',
        email: 'student@starter.lk',
        role: UserRole.STUDENT,
        tenantPlan: 'STARTER',
    };

    const assetUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

    beforeEach(async () => {
        mockAdminClient = {
            from: jest.fn().mockImplementation((table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    range: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            data: [
                                {
                                    id: 'asset-1',
                                    title: 'Physics Mechanics 01',
                                    cloudinary_public_id: 'physics_01',
                                    cloudinary_secure_url: 'https://res.cloudinary.com/demo/video/upload/physics.mp4',
                                    mp4_url: 'https://res.cloudinary.com/demo/video/upload/physics.mp4',
                                    hls_url: 'https://res.cloudinary.com/demo/video/upload/physics.m3u8',
                                    file_size_bytes: 52428800,
                                    status: 'ready',
                                    is_downloadable: true,
                                },
                            ],
                            count: 1,
                            error: null,
                        });
                    }),
                    maybeSingle: jest.fn().mockImplementation(() => {
                        if (table === 'tenant_storage_usage') {
                            return Promise.resolve({
                                data: { is_quota_exceeded: false, total_bytes_used: 1000000, storage_quota_gb: 10 },
                                error: null,
                            });
                        }
                        if (table === 'plans') {
                            return Promise.resolve({
                                data: { offline_retention_days: 30 },
                                error: null,
                            });
                        }
                        return Promise.resolve({
                            data: {
                                id: assetUuid,
                                tenant_id: teacherGrowth.tenantId,
                                uploaded_by: teacherGrowth.sub,
                                title: 'Physics Mechanics 01',
                                cloudinary_public_id: 'physics_01',
                                cloudinary_secure_url: 'https://res.cloudinary.com/demo/video/upload/physics.mp4',
                                mp4_url: 'https://res.cloudinary.com/demo/video/upload/physics.mp4',
                                hls_url: 'https://res.cloudinary.com/demo/video/upload/physics.m3u8',
                                file_size_bytes: 52428800,
                                duration_seconds: 1800,
                                status: 'ready',
                                is_downloadable: true,
                            },
                            error: null,
                        });
                    }),
                    insert: jest.fn().mockImplementation((payload: any) => {
                        const b: any = {
                            select: jest.fn().mockReturnThis(),
                            single: jest.fn().mockResolvedValue({
                                data: { id: 'asset-new', ...payload },
                                error: null,
                            }),
                        };
                        return b;
                    }),
                    update: jest.fn().mockImplementation(() => {
                        const b: any = {
                            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
                        };
                        return b;
                    }),
                };
                return builder;
            }),
        };

        mockSupabase = {
            adminClient: mockAdminClient,
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MediaService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<MediaService>(MediaService);
    });

    it('should strip direct MP4 and HLS urls for Community / Starter callers in listAssets', async () => {
        const result = await service.listAssets(studentStarter, {});
        expect(result.data.length).toBe(1);
        expect(result.data[0].mp4_url).toBeNull();
        expect(result.data[0].hls_url).toBeNull();
        expect(result.data[0].is_downloadable).toBe(false);
    });

    it('should keep direct MP4 and HLS urls for Growth callers in listAssets', async () => {
        const result = await service.listAssets(studentGrowth, {});
        expect(result.data.length).toBe(1);
        expect(result.data[0].mp4_url).toBeTruthy();
        expect(result.data[0].hls_url).toBeTruthy();
        expect(result.data[0].is_downloadable).toBe(true);
    });

    it('should reject offline download manifest generation for Starter plan', async () => {
        await expect(
            service.getDownloadManifest(studentStarter, assetUuid),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should generate signed expiring download manifest with signature for Growth plan', async () => {
        const manifest = await service.getDownloadManifest(studentGrowth, assetUuid);
        expect(manifest.success).toBe(true);
        expect(manifest.assetId).toBe(assetUuid);
        expect(manifest.mp4Url).toContain('exp=');
        expect(manifest.mp4Url).toContain('sig=');
        expect(manifest.signature).toBeTruthy();
        expect(manifest.retentionDays).toBe(30);
    });

    it('should reject direct video upload from Community / Starter plan with ForbiddenException', async () => {
        await expect(
            service.createAsset(teacherCommunity, {
                title: 'Direct Video',
                cloudinaryPublicId: 'upload_video_123',
                cloudinarySecureUrl: 'https://res.cloudinary.com/demo/video/upload/direct.mp4',
                fileSizeBytes: 50000000,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should allow embedded YouTube / external links for Starter/Community and set status ready', async () => {
        const result = await service.createAsset(teacherCommunity, {
            title: 'External Lesson',
            cloudinaryPublicId: 'embed_yt_123',
            cloudinarySecureUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            fileSizeBytes: 0,
        });
        expect(result.success).toBe(true);
        expect(result.asset.status).toBe('ready');
    });

    it('should initiate direct video uploads for Growth plan in processing status', async () => {
        const result = await service.createAsset(teacherGrowth, {
            title: 'Calculus Chapter 1',
            cloudinaryPublicId: 'edulanka/22222222-2222-2222-2222-222222222222/calc_01',
            cloudinarySecureUrl: 'https://res.cloudinary.com/demo/video/upload/calc.mp4',
            fileSizeBytes: 104857600,
        });
        expect(result.success).toBe(true);
        expect(result.asset.status).toBe('processing');
    });

    it('should reject direct video uploads when cloudinaryPublicId does not start with tenant prefix', async () => {
        await expect(
            service.createAsset(teacherGrowth, {
                title: 'Malicious Upload',
                cloudinaryPublicId: 'edulanka/other-tenant-id/calc_01',
                cloudinarySecureUrl: 'https://res.cloudinary.com/demo/video/upload/calc.mp4',
                fileSizeBytes: 104857600,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw PayloadTooLargeException when storage quota is exceeded', async () => {
        mockAdminClient.from = jest.fn().mockImplementation((_table: string) => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { is_quota_exceeded: true, storage_quota_gb: 1 },
                error: null,
            }),
        }));

        await expect(
            service.createAsset(teacherGrowth, {
                title: 'Calculus Chapter 2',
                cloudinaryPublicId: 'edulanka/22222222-2222-2222-2222-222222222222/calc_02',
                cloudinarySecureUrl: 'https://res.cloudinary.com/demo/video/upload/calc2.mp4',
                fileSizeBytes: 2000000000,
            }),
        ).rejects.toThrow(PayloadTooLargeException);
    });

    it('should prevent teacher from deleting media uploaded by another user', async () => {
        const otherTeacher: JwtPayload = {
            sub: '99999999-9999-9999-9999-999999999999',
            tenantId: teacherGrowth.tenantId,
            email: 'other@school.lk',
            role: UserRole.TEACHER,
        };

        await expect(
            service.deleteAsset(otherTeacher, assetUuid),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should allow teacher who uploaded the asset to soft-delete it and adjust ledger', async () => {
        const result = await service.deleteAsset(teacherGrowth, assetUuid);
        expect(result.success).toBe(true);
    });

    describe('isAllowedMediaUrl security', () => {
        const originalEnv = process.env['NODE_ENV'];

        afterEach(() => {
            process.env['NODE_ENV'] = originalEnv;
        });

        it('rejects localhost and 127.0.0.1 when NODE_ENV is production', () => {
            process.env['NODE_ENV'] = 'production';
            expect(isAllowedMediaUrl('https://localhost/video.mp4')).toBe(false);
            expect(isAllowedMediaUrl('https://127.0.0.1/video.mp4')).toBe(false);
            expect(isAllowedMediaUrl('https://res.cloudinary.com/demo/video.mp4')).toBe(true);
        });

        it('allows localhost and 127.0.0.1 when NODE_ENV is development or test', () => {
            process.env['NODE_ENV'] = 'development';
            expect(isAllowedMediaUrl('https://localhost/video.mp4')).toBe(true);
            expect(isAllowedMediaUrl('https://127.0.0.1/video.mp4')).toBe(true);
        });
    });
});
