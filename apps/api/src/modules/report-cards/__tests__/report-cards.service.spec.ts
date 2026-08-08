import { Test, TestingModule } from '@nestjs/testing';
import { ReportCardsService } from '../report-cards.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';

describe('ReportCardsService', () => {
    let service: ReportCardsService;

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
                    useValue: { findOneById: jest.fn().mockResolvedValue({ slug: 'test' }) }
                }
            ],
        }).compile();

        service = module.get<ReportCardsService>(ReportCardsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
