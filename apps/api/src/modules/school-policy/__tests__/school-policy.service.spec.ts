import { Test, TestingModule } from '@nestjs/testing';
import { SchoolPolicyService } from '../school-policy.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { Logger, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('SchoolPolicyService', () => {
  let service: SchoolPolicyService;
  let mockSupabaseService: any;
  let mockTenantService: any;
  let mockDb: any;

  beforeEach(async () => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
    };

    mockSupabaseService = {
      getTenantClient: jest.fn().mockReturnValue(mockDb),
    };

    mockTenantService = {
      findOneById: jest.fn().mockResolvedValue({ slug: 'test-tenant' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolPolicyService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<SchoolPolicyService>(SchoolPolicyService);
  });

  afterEach(() => {
        jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('updatePolicy', () => {
    const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
    const teacherCaller = { sub: 'teacher-id', role: UserRole.TEACHER, tenantId: 'tenant-1' } as any;
    const updateDto = { maxStudentsPerClass: 30 };

    it('should throw ForbiddenException if caller is not an admin', async () => {
      await expect(service.updatePolicy(updateDto, teacherCaller))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if policy is not found (uninitialized tenant)', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.updatePolicy(updateDto, adminCaller))
        .rejects.toThrow(NotFoundException);
      await expect(service.updatePolicy(updateDto, adminCaller))
        .rejects.toThrow('School policy not found');
    });

    it('should throw InternalServerErrorException on update failure', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'policy-1' }, error: null });
      mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

      await expect(service.updatePolicy(updateDto, adminCaller))
        .rejects.toThrow(InternalServerErrorException);
    });

    it('should successfully update and return the policy', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'policy-1' }, error: null });
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'policy-1', max_students_per_class: 30 }, error: null });

      const result = await service.updatePolicy(updateDto, adminCaller);
      expect(result).toBeDefined();
      expect(result.max_students_per_class).toBe(30);
    });
  });

  describe('getPolicy', () => {
    const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;

    it('should throw NotFoundException if policy is not initialized', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.getPolicy(adminCaller))
        .rejects.toThrow(NotFoundException);
    });

    it('should return the school policy', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'policy-1', max_students_per_class: 30 }, error: null });

      const result = await service.getPolicy(adminCaller);
      expect(result).toBeDefined();
      expect(result.max_students_per_class).toBe(30);
    });
  });
});
