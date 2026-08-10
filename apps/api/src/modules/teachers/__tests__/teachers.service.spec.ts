import { Test, TestingModule } from '@nestjs/testing';
import { TeachersService } from '../teachers.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { Logger, ForbiddenException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('TeachersService', () => {
  let service: TeachersService;
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
        TeachersService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<TeachersService>(TeachersService);
  });

  afterEach(() => {
        jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('create', () => {
    const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
    const teacherCaller = { sub: 'teacher-id', role: UserRole.TEACHER, tenantId: 'tenant-1' } as any;
    const validDto = { email: 'teacher@test.com', fullName: 'Jane Doe', temporaryPassword: 'password123' };

    it('should throw ForbiddenException if caller is not an admin', async () => {
      await expect(service.create(validDto, teacherCaller))
        .rejects.toThrow(ForbiddenException);
      await expect(service.create(validDto, teacherCaller))
        .rejects.toThrow('Only school admins can manage teachers');
    });

    it('should successfully create a teacher and return the record', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-id' } },
        error: null,
      });

      // Mock users insert
      mockDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null });
      // Mock teachers insert
      mockDb.single.mockResolvedValueOnce({
        data: { id: 'db-teacher-id', employee_no: 'EMP/2026/0001' },
        error: null,
      });

      const result = await service.create(validDto, adminCaller);
      expect(result.id).toBe('db-teacher-id');
      expect(mockSupabaseService.adminClient.auth.admin.createUser).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should throw InternalServerErrorException if Auth user creation fails', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'some error' },
      });

      await expect(service.create(validDto, adminCaller)).rejects.toThrow(InternalServerErrorException);
    });

    it('should rollback auth and throw ConflictException if teacher employee number exists (code 23505)', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-id' } },
        error: null,
      });

      mockDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      });

      await expect(service.create(validDto, adminCaller)).rejects.toThrow(ConflictException);
      expect(mockSupabaseService.adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('auth-id');
    });
  });
});
