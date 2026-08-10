import { Test, TestingModule } from '@nestjs/testing';
import { ParentsService } from '../parents.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole, ParentRelationship } from '@edu-lanka/shared-types';

describe('ParentsService', () => {
  let service: ParentsService;
  let mockSupabaseService: any;
  let mockTenantService: any;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };

    mockSupabaseService = {
      getTenantClient: jest.fn().mockReturnValue(mockDb),
    };

    mockTenantService = {
      findOneById: jest.fn().mockResolvedValue({ slug: 'test-tenant' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<ParentsService>(ParentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('linkToStudent', () => {
    const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
    const parentCaller = { sub: 'parent-id', role: UserRole.PARENT, tenantId: 'tenant-1' } as any;
    const validDto = { studentId: 'student-id', relationship: ParentRelationship.MOTHER };
    const parentUserId = 'parent-user-id';

    it('should throw ForbiddenException if caller is not an admin', async () => {
      await expect(service.linkToStudent(parentUserId, validDto, parentCaller))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if parent user does not exist or lacks PARENT role', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.linkToStudent(parentUserId, validDto, adminCaller))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already linked (code 23505)', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: parentUserId, role: UserRole.PARENT }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      await expect(service.linkToStudent(parentUserId, validDto, adminCaller))
        .rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if student does not exist (code 23503)', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: parentUserId, role: UserRole.PARENT }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23503', message: 'foreign key constraint' },
      });

      await expect(service.linkToStudent(parentUserId, validDto, adminCaller))
        .rejects.toThrow(NotFoundException);
    });

    it('should successfully link parent to student', async () => {
      mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: parentUserId, role: UserRole.PARENT }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: { id: 'link-id', parent_user_id: parentUserId, student_id: validDto.studentId },
        error: null,
      });

      const result = await service.linkToStudent(parentUserId, validDto, adminCaller);
      expect(result).toBeDefined();
      expect(result.student_id).toBe(validDto.studentId);
    });
  });
});
