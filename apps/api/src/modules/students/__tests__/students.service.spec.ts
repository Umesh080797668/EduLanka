import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from '../students.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { Logger, ForbiddenException, ConflictException, } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('StudentsService', () => {
  let service: StudentsService;
  let mockSupabaseService: any;
  let mockTenantService: any;
  let mockDb: any;

  beforeEach(async () => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    mockDb = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };

    mockSupabaseService = {
      getTenantClient: jest.fn().mockReturnValue(mockDb),
      adminClient: {
        auth: {
          admin: {
            createUser: jest.fn(),
            deleteUser: jest.fn().mockResolvedValue({}),
          },
        },
      },
    };

    mockTenantService = {
      findOneById: jest.fn().mockResolvedValue({ slug: 'test-tenant' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
  });

  afterEach(() => {
        jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('enroll', () => {
    const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
    const studentCaller = { sub: 'student-id', role: UserRole.STUDENT, tenantId: 'tenant-1' } as any;
    const validDto = { fullName: 'John Doe', temporaryPassword: 'password123' };

    it('should throw ForbiddenException if caller is not an admin', async () => {
      await expect(service.enroll(validDto, studentCaller))
        .rejects.toThrow(ForbiddenException);
    });

    it('should successfully enroll a student and return the student record', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-id' } },
        error: null,
      });

      // Mock users insert
      mockDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null });
      // Mock students insert
      mockDb.single.mockResolvedValueOnce({
        data: { id: 'db-student-id', admission_no: '2026/0001' },
        error: null,
      });

      const result = await service.enroll(validDto, adminCaller);
      expect(result.id).toBe('db-student-id');
      expect(mockSupabaseService.adminClient.auth.admin.createUser).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException if Auth user creation fails with "email address" in message', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'email address already in use' },
      });

      await expect(service.enroll(validDto, adminCaller)).rejects.toThrow(ConflictException);
    });

    it('should rollback auth and throw ConflictException if student admission number exists (code 23505)', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-id' } },
        error: null,
      });

      mockDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      await expect(service.enroll(validDto, adminCaller)).rejects.toThrow(ConflictException);
      expect(mockSupabaseService.adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('auth-id');
    });

    it('should rollback auth and throw ForbiddenException if 250 cap is exceeded', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-id' } },
        error: null,
      });

      mockDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: 'Free tier cap exceeded: Max 250 students allowed.' },
      });

      await expect(service.enroll(validDto, adminCaller)).rejects.toThrow(/cap exceeded/);
      expect(mockSupabaseService.adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('auth-id');
    });
  });
});
