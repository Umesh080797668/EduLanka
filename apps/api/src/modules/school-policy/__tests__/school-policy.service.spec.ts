import { Test, TestingModule } from '@nestjs/testing';
import { SchoolPolicyService } from '../school-policy.service';

describe('SchoolPolicyService', () => {
  let service: SchoolPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolPolicyService,
        {
          provide: 'SupabaseService',
          useValue: { getTenantClient: jest.fn(), adminClient: { auth: { admin: { deleteUser: jest.fn() } } } }
        },
        {
          provide: 'TenantService',
          useValue: { findOneById: jest.fn().mockResolvedValue({ slug: 'test' }) }
        }

      ],
    }).compile();

    service = module.get<SchoolPolicyService>(SchoolPolicyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
