import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { MobileReleaseService } from '../mobile-release.service';

describe('MobileReleaseService', () => {
    let service: MobileReleaseService;
    let mockSupabase: any;
    let mockAdminClient: any;

    const superAdmin: JwtPayload = {
        sub: '33333333-3333-3333-3333-333333333333',
        tenantId: '11111111-1111-1111-1111-111111111111',
        email: 'superadmin@edulanka.lk',
        role: UserRole.SUPER_ADMIN,
    };

    const regularTeacher: JwtPayload = {
        sub: '44444444-4444-4444-4444-444444444444',
        tenantId: '11111111-1111-1111-1111-111111111111',
        email: 'teacher@edulanka.lk',
        role: UserRole.TEACHER,
    };

    beforeEach(async () => {
        mockAdminClient = {
            from: jest.fn().mockImplementation((_table: string) => {
                const builder: any = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    or: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: 'v-1',
                            platform: 'android',
                            min_version: '1.0.0',
                            latest_version: '1.2.0',
                            release_notes: 'Release 1.2.0',
                            force_update: false,
                        },
                        error: null,
                    }),
                    upsert: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: 'v-1',
                            platform: 'android',
                            min_version: '1.1.0',
                            latest_version: '1.2.0',
                            release_notes: 'Updated notes',
                            force_update: false,
                        },
                        error: null,
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
                MobileReleaseService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<MobileReleaseService>(MobileReleaseService);
    });

    it('should return version metadata for platform', async () => {
        const result = await service.getVersion('android');
        expect(result.minVersion).toBe('1.0.0');
        expect(result.latestVersion).toBe('1.2.0');
    });

    it('should reject non-super-admin from updating version', async () => {
        await expect(
            service.updateVersion(regularTeacher, {
                minVersion: '1.0.0',
                latestVersion: '1.2.0',
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject invalid SemVer strings', async () => {
        await expect(
            service.updateVersion(superAdmin, {
                minVersion: 'invalid-version',
                latestVersion: '1.2.0',
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should reject minVersion > latestVersion to prevent locking users out', async () => {
        await expect(
            service.updateVersion(superAdmin, {
                minVersion: '999.0.0',
                latestVersion: '1.2.0',
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update version when minVersion <= latestVersion', async () => {
        const result = await service.updateVersion(superAdmin, {
            platform: 'android',
            minVersion: '1.1.0',
            latestVersion: '1.2.0',
            releaseNotes: 'Updated notes',
            forceUpdate: false,
        });

        expect(result.success).toBe(true);
        expect(result.version.minVersion).toBe('1.1.0');
        expect(result.version.latestVersion).toBe('1.2.0');
    });
});
