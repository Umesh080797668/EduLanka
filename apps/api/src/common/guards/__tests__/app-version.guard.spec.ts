import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../../modules/supabase/supabase.service';
import { AppVersionGuard, HTTP_STATUS_UPGRADE_REQUIRED } from '../app-version.guard';

describe('AppVersionGuard', () => {
    let guard: AppVersionGuard;
    let mockSupabase: any;

    beforeEach(async () => {
        AppVersionGuard.clearCache();
        mockSupabase = {
            adminClient: {
                from: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnThis(),
                    or: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            min_version: '2.0.0',
                            latest_version: '2.5.0',
                            release_notes: 'Major update required',
                            force_update: true,
                        },
                        error: null,
                    }),
                }),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppVersionGuard,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        guard = module.get<AppVersionGuard>(AppVersionGuard);
    });

    const createMockContext = (url: string, headers: Record<string, string>): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    url,
                    headers,
                }),
            }),
        } as unknown as ExecutionContext;
    };

    it('should bypass version check for /mobile/version', async () => {
        const context = createMockContext('/mobile/version', { 'x-client-version': '1.0.0' });
        const canActivate = await guard.canActivate(context);
        expect(canActivate).toBe(true);
    });

    it('should bypass version check for /mobile/public-key', async () => {
        const context = createMockContext('/mobile/public-key', { 'x-client-version': '1.0.0' });
        const canActivate = await guard.canActivate(context);
        expect(canActivate).toBe(true);
    });

    it('should allow requests without x-client-version header for non-mobile routes (web)', async () => {
        const context = createMockContext('/api/v1/auth/me', {});
        const canActivate = await guard.canActivate(context);
        expect(canActivate).toBe(true);
    });

    it('should reject mobile requests missing x-client-version header with 426 Upgrade Required', async () => {
        const context = createMockContext('/mobile/sync-events', {});
        await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
        try {
            await guard.canActivate(context);
        } catch (err: any) {
            expect(err.getStatus()).toBe(HTTP_STATUS_UPGRADE_REQUIRED);
            expect(err.getResponse().message).toContain('required for mobile requests');
        }
    });

    it('should reject mobile requests having platform header but missing x-client-version with 426 Upgrade Required', async () => {
        const context = createMockContext('/api/v1/homework', {
            'x-client-platform': 'android',
        });
        await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should reject outdated mobile client with 426 Upgrade Required', async () => {
        const context = createMockContext('/mobile/sync-events', {
            'x-client-version': '1.5.0',
            'x-client-platform': 'android',
        });

        await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
        try {
            await guard.canActivate(context);
        } catch (err: any) {
            expect(err.getStatus()).toBe(HTTP_STATUS_UPGRADE_REQUIRED);
            expect(err.getResponse().minVersion).toBe('2.0.0');
        }
    });

    it('should allow mobile client matching or exceeding min_version', async () => {
        const context = createMockContext('/mobile/sync-events', {
            'x-client-version': '2.0.0',
            'x-client-platform': 'android',
        });
        const canActivate = await guard.canActivate(context);
        expect(canActivate).toBe(true);
    });

    it('should use in-memory cache and not re-query DB on subsequent requests', async () => {
        const context = createMockContext('/mobile/sync-events', {
            'x-client-version': '2.0.0',
            'x-client-platform': 'android',
        });
        await guard.canActivate(context);
        await guard.canActivate(context);

        expect(mockSupabase.adminClient.from).toHaveBeenCalledTimes(1);
    });
});
