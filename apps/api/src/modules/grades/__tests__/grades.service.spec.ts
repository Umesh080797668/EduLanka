
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { GradesService } from '../grades.service';

describe('GradesService', () => {
  let service: GradesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GradesService,
        {
          provide: SupabaseService,
          useValue: { getTenantClient: jest.fn(), adminClient: { auth: { admin: { deleteUser: jest.fn() } } } }
        },
        {
          provide: TenantService,
          useValue: { findOneById: jest.fn().mockResolvedValue({ slug: 'test' }) }
        }

      ],
    }).compile();

    service = module.get<GradesService>(GradesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
