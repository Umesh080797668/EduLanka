import { ForbiddenException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { PlanFeaturesService, PlanFeature } from '../plan-features.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('PlanFeaturesService', () => {
    let service: PlanFeaturesService;
    let mockSupabase: any;

    beforeEach(async () => {
        mockSupabase = {
            adminClient: {
                from: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PlanFeaturesService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<PlanFeaturesService>(PlanFeaturesService);
    });

    describe('getTenantPlan fail-closed behavior', () => {
        it('returns COMMUNITY if tenantId is missing or empty', async () => {
            const plan = await service.getTenantPlan('');
            expect(plan).toBe('COMMUNITY');
        });

        it('fails closed to COMMUNITY on query error', async () => {
            mockSupabase.adminClient.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Database connection timeout' },
                        }),
                    }),
                }),
            });

            const plan = await service.getTenantPlan('t-fail');
            expect(plan).toBe('COMMUNITY');
        });

        it('fails closed to COMMUNITY if tenant row or plan is missing', async () => {
            mockSupabase.adminClient.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    }),
                }),
            });

            const plan = await service.getTenantPlan('t-missing');
            expect(plan).toBe('COMMUNITY');
        });

        it('returns actual plan when found', async () => {
            mockSupabase.adminClient.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { plan: 'GROWTH' },
                            error: null,
                        }),
                    }),
                }),
            });

            const plan = await service.getTenantPlan('t-growth');
            expect(plan).toBe('GROWTH');
        });
    });

    describe('assertFeature', () => {
        it('allows OFFLINE_SYNC on STARTER and above', () => {
            expect(() => service.assertFeature('STARTER', PlanFeature.OFFLINE_SYNC)).not.toThrow();
            expect(() => service.assertFeature('GROWTH', PlanFeature.OFFLINE_SYNC)).not.toThrow();
            expect(() => service.assertFeature('INSTITUTIONAL', PlanFeature.OFFLINE_SYNC)).not.toThrow();
        });

        it('rejects OFFLINE_SYNC on COMMUNITY', () => {
            expect(() => service.assertFeature('COMMUNITY', PlanFeature.OFFLINE_SYNC)).toThrow(ForbiddenException);
        });
    });
});
