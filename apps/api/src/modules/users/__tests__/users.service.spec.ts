
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { RedisService } from '../../redis/redis.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: SupabaseService,
          useValue: { getTenantClient: jest.fn(), adminClient: { auth: { admin: { deleteUser: jest.fn() } } } }
        },
        {
          provide: TenantService,
          useValue: { findOneById: jest.fn().mockResolvedValue({ slug: 'test' }) }
        },
        {
          provide: RedisService,
          useValue: {
            cacheUserActive: jest.fn().mockResolvedValue(undefined),
            invalidateUserActiveCache: jest.fn().mockResolvedValue(undefined),
            revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
          }
        }
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
