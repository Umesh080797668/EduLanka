import { UserRole } from '@edu-lanka/shared-types';
import { Logger, ForbiddenException, ConflictException, } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { ChatService } from '../../chat/chat.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { StudentsService } from '../students.service';


describe('StudentsService', () => {
  let service: StudentsService;
  let mockSupabaseService: any;
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: ChatService, useValue: { syncClassParticipants: jest.fn().mockResolvedValue(0) } },
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

    it('should rollback auth and throw ForbiddenException if 75 cap is exceeded', async () => {
      mockSupabaseService.adminClient.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-id' } },
        error: null,
      });

      mockDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null });
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'P0001', message: 'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.' },
      });

      const enrollPromise = service.enroll(validDto, adminCaller);
      await expect(enrollPromise).rejects.toThrow(ForbiddenException);
      await expect(enrollPromise).rejects.toThrow(/tier limit exceeded/);
      expect(mockSupabaseService.adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('auth-id');
    });
  });
});
