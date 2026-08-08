import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from '../classes.service';

describe('ClassesService', () => {
  let service: ClassesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
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

    service = module.get<ClassesService>(ClassesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
