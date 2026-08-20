import { Test, TestingModule } from '@nestjs/testing';
import { StudentMarksService } from '../student-marks.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { Logger, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('StudentMarksService', () => {
    let service: StudentMarksService;
    let mockSupabaseService: any;
    let mockTenantService: any;
    let mockDb: any;

    beforeEach(async () => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => { });
        mockDb = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve({ data: [], error: null })),
        };

        mockSupabaseService = {
            getTenantClient: jest.fn().mockReturnValue(mockDb),
        };

        mockTenantService = {
            findOneById: jest.fn().mockResolvedValue({ slug: 'test-tenant' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StudentMarksService,
                { provide: SupabaseService, useValue: mockSupabaseService },
                { provide: TenantService, useValue: mockTenantService },
            ],
        }).compile();

        service = module.get<StudentMarksService>(StudentMarksService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe('upsertMark', () => {
        const studentCaller = { sub: 'student-id', role: UserRole.STUDENT, tenantId: 'tenant-1' } as any;
        const teacherCaller = { sub: 'teacher-id', role: UserRole.TEACHER, tenantId: 'tenant-1' } as any;
        const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
        const markDto = { studentId: 'student-1', classId: 'class-1', subject: 'Math', term: 1, academicYear: 2026, marks: 95 };

        it('should throw ForbiddenException if caller is student or parent', async () => {
            await expect(service.upsertMark(markDto, studentCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should successfully upsert mark for teacher caller', async () => {
            // mock user fetch for teacher -> mock teacher fetch -> mock upsert
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null }); // from users
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'db-teacher-id' }, error: null }); // from teachers
            mockDb.single.mockResolvedValueOnce({ data: { id: 'mark-1' }, error: null }); // from student_marks

            const result = await service.upsertMark(markDto, teacherCaller);
            expect(result).toBeDefined();
            expect(mockDb.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ tenant_id: 'tenant-1' }),
                expect.any(Object)
            );
        });

        it('should successfully upsert mark for admin caller without fetching teacher logic', async () => {
            mockDb.single.mockResolvedValueOnce({ data: { id: 'mark-1' }, error: null }); // from student_marks

            const result = await service.upsertMark(markDto, adminCaller);
            expect(result).toBeDefined();
            expect(mockDb.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ tenant_id: 'tenant-1' }),
                expect.any(Object)
            );
        });

        it('should throw InternalServerErrorException on db error', async () => {
            mockDb.single.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });
            await expect(service.upsertMark(markDto, adminCaller)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getMarksByClass', () => {
        const studentCaller = { sub: 'student-id', role: UserRole.STUDENT, tenantId: 'tenant-1' } as any;
        const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;

        it('should throw ForbiddenException for students or parents', async () => {
            await expect(service.getMarksByClass('class-1', 1, studentCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should fetch marks for authorized caller', async () => {
            mockDb.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'mark-1' }], error: null }));
            const result = await service.getMarksByClass('class-1', 1, adminCaller);
            expect(result).toHaveLength(1);
        });
    });

    describe('getMarksByStudent', () => {
        const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
        const studentCaller = { sub: 'student-id', role: UserRole.STUDENT, tenantId: 'tenant-1' } as any;
        const parentCaller = { sub: 'parent-id', role: UserRole.PARENT, tenantId: 'tenant-1' } as any;

        const mockMarksReturn = { data: [{ id: 'mark-1' }], error: null };

        it('should return marks without restriction for admin', async () => {
            mockDb.then.mockImplementationOnce((resolve: any) => resolve(mockMarksReturn));
            const result = await service.getMarksByStudent('student-1', adminCaller);
            expect(result).toHaveLength(1);
        });

        it('should throw ForbiddenException for student accessing another student marks', async () => {
            // inner user join returns a different id
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { users: { user_id: 'other-student-id' } }, error: null });
            await expect(service.getMarksByStudent('student-1', studentCaller)).rejects.toThrow(ForbiddenException);
        });

        it('should return marks for student accessing their own marks', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { users: { user_id: 'student-id' } }, error: null });
            mockDb.then.mockImplementationOnce((resolve: any) => resolve(mockMarksReturn));
            const result = await service.getMarksByStudent('student-1', studentCaller);
            expect(result).toHaveLength(1);
        });

        it('should throw ForbiddenException for parent accessing unlinked student marks', async () => {
            // resolve parent db user id
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'db-parent-id' }, error: null }); // from users
            // resolve link
            mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // from parent_children

            await expect(service.getMarksByStudent('student-1', parentCaller)).rejects.toThrow(ForbiddenException);
        });

        it('should return marks for parent accessing linked student', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'db-parent-id' }, error: null }); // users
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'pc-1' }, error: null }); // parent_children
            mockDb.then.mockImplementationOnce((resolve: any) => resolve(mockMarksReturn));

            const result = await service.getMarksByStudent('student-1', parentCaller);
            expect(result).toHaveLength(1);
        });
    });
});
