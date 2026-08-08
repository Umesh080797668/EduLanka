import { Test, TestingModule } from '@nestjs/testing';
import { TeachersService } from '../teachers.service';

describe('TeachersService', () => {
  let service: TeachersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachersService,
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

    service = module.get<TeachersService>(TeachersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
