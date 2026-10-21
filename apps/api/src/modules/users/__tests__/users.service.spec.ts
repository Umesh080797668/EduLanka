
import { UserRole } from '@edu-lanka/shared-types';
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

  describe('resolveRole', () => {
    it('should correctly map standard aliases to canonical roles', () => {
      expect(service.resolveRole('pupil')).toBe(UserRole.STUDENT);
      expect(service.resolveRole('learner')).toBe(UserRole.STUDENT);
      expect(service.resolveRole('instructor')).toBe(UserRole.TEACHER);
      expect(service.resolveRole('faculty')).toBe(UserRole.TEACHER);
      expect(service.resolveRole('guardian')).toBe(UserRole.PARENT);
      expect(service.resolveRole('principal')).toBe(UserRole.SCHOOL_ADMIN);
    });

    it('should respect custom tenant role mapping', () => {
      const customMapping = {
        'lab_assistant': 'TEACHER',
        'head_boy': 'STUDENT',
      };
      expect(service.resolveRole('lab_assistant', customMapping)).toBe(UserRole.TEACHER);
      expect(service.resolveRole('head_boy', customMapping)).toBe(UserRole.STUDENT);
    });

    it('should throw BadRequestException on unmapped unknown role instead of hardcoding STUDENT', () => {
      expect(() => service.resolveRole('unknown_custom_role')).toThrow();
      expect(() => service.resolveRole('')).toThrow();
    });
  });

  describe('bulkImportUsers', () => {
    const adminCaller: any = {
      sub: 'admin-uuid',
      tenantId: 'tenant-uuid',
      role: UserRole.SCHOOL_ADMIN,
    };

    it('should fail if all rows have invalid unmapped roles', async () => {
      await expect(
        service.bulkImportUsers(
          {
            rows: [
              { fullName: 'Alice Perera', email: 'alice@test.lk', role: 'invalid_role_xyz' },
            ],
          },
          adminCaller,
        ),
      ).rejects.toThrow();
    });

    it('should import valid rows and map custom roles', async () => {
      jest.spyOn(service, 'create').mockResolvedValue({ id: 'u-1', full_name: 'Bob' } as any);

      const result = await service.bulkImportUsers(
        {
          rows: [
            { fullName: 'Bob Silva', email: 'bob@test.lk', role: 'special_mentor' },
          ],
          customRoleMapping: {
            'special_mentor': 'TEACHER',
          },
        },
        adminCaller,
      );

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(1);
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Bob Silva',
          role: UserRole.TEACHER,
        }),
        adminCaller,
      );
    });
  });
});
