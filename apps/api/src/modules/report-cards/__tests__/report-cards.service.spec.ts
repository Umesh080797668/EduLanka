import { Test, TestingModule } from '@nestjs/testing';
import { ReportCardsService } from '../report-cards.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { UserRole } from '@edu-lanka/shared-types';

describe('ReportCardsService', () => {
    let service: ReportCardsService;
    let tenantService: TenantService;
    let supabaseService: SupabaseService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportCardsService,
                {
                    provide: SupabaseService,
                    useValue: { getTenantClient: jest.fn() }
                },
                {
                    provide: TenantService,
                    useValue: { findOneById: jest.fn() }
                }
            ],
        }).compile();

        service = module.get<ReportCardsService>(ReportCardsService);
        tenantService = module.get<TenantService>(TenantService);
        supabaseService = module.get<SupabaseService>(SupabaseService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should strictly request the tenant DB client using the UUID (tenant.id) instead of the slug', async () => {
        const mockTenantId = '1234abcd-1234-abcd-1234-abcd1234abcd';
        const caller: any = { tenantId: mockTenantId, sub: 'u1', role: UserRole.STUDENT };

        jest.spyOn(tenantService, 'findOneById').mockResolvedValue({
            id: mockTenantId,
            slug: 'test-slug',
            name: 'Test Tenant'
        } as any);

        const mockQueryBuilder = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
        };

        const getTenantClientSpy = jest.spyOn(supabaseService, 'getTenantClient').mockReturnValue(mockQueryBuilder as any);

        try {
            await service.generateReportCard('student-123', 1, 2026, caller);
        } catch (e) {
            // InternalServerErrorException from "Error gathering marks"
        }

        expect(getTenantClientSpy).toHaveBeenCalledWith(mockTenantId);
        expect(getTenantClientSpy).not.toHaveBeenCalledWith('test-slug');
    });
});
