import { Test, TestingModule } from '@nestjs/testing';
import { StudentMarksService } from '../student-marks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';

describe('StudentMarksService', () => {
    let service: StudentMarksService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StudentMarksService,
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

        service = module.get<StudentMarksService>(StudentMarksService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
