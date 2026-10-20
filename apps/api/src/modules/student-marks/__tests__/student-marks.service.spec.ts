import { UserRole } from '@edu-lanka/shared-types';
import { Logger, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { StudentMarksService } from '../student-marks.service';

describe('StudentMarksService', () => {
    let service: StudentMarksService;
    let mockSupabaseService: any;
    let mockTenantService: any;
    let mockDb: any;

    beforeEach(async () => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => { });
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => { });
        mockDb = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve({ data: [], error: null })),
        };

        mockSupabaseService = {
            getTenantClient: jest.fn().mockReturnValue(mockDb),
            adminClient: mockDb,
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
        const teacherCaller = { sub: 'teacher-user-id', role: UserRole.TEACHER, tenantId: 'tenant-1' } as any;
        const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;
        const markDto = { studentId: 'student-1', classId: 'class-1', subject: 'Math', term: 1, academicYear: 2026, marks: 95 };

        it('should throw ForbiddenException if caller is student or parent', async () => {
            await expect(service.upsertMark(markDto, studentCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should successfully upsert mark for assigned teacher caller', async () => {
            // 1. teacher query
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'teacher-id' }, error: null });
            // 2. class_teacher assignment query
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'assignment-id' }, error: null });
            // 3. student query
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'student-1', class_id: 'class-1' }, error: null });
            // 4. term_finalizations query
            mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            // 5. student_marks upsert
            mockDb.single.mockResolvedValueOnce({ data: { id: 'mark-1' }, error: null });

            const result = await service.upsertMark(markDto, teacherCaller);
            expect(result).toBeDefined();
            expect(mockDb.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ tenant_id: 'tenant-1', academic_year: 2026, grade: 'A' }),
                expect.any(Object)
            );
        });

        it('should throw ForbiddenException if teacher is not assigned to the class', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'teacher-id' }, error: null });
            mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // no assignment

            await expect(service.upsertMark(markDto, teacherCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if student does not belong to the class', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'student-1', class_id: 'other-class' }, error: null });

            await expect(service.upsertMark(markDto, adminCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException if term marks have been finalized', async () => {
            // student query
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'student-1', class_id: 'class-1' }, error: null });
            // term_finalizations query (locked)
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'fin-1', is_finalized: true }, error: null });

            await expect(service.upsertMark(markDto, adminCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should successfully upsert mark for admin caller without teacher assignment check', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'student-1', class_id: 'class-1' }, error: null });
            mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // not finalized
            mockDb.single.mockResolvedValueOnce({ data: { id: 'mark-1' }, error: null });

            const result = await service.upsertMark(markDto, adminCaller);
            expect(result).toBeDefined();
            expect(mockDb.upsert).toHaveBeenCalledWith(
                expect.objectContaining({ tenant_id: 'tenant-1' }),
                expect.any(Object)
            );
        });

        it('should throw InternalServerErrorException on db error', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'student-1', class_id: 'class-1' }, error: null });
            mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            mockDb.single.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

            await expect(service.upsertMark(markDto, adminCaller)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getMarksByClass', () => {
        const studentCaller = { sub: 'student-id', role: UserRole.STUDENT, tenantId: 'tenant-1' } as any;
        const teacherCaller = { sub: 'teacher-user-id', role: UserRole.TEACHER, tenantId: 'tenant-1' } as any;
        const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;

        it('should throw ForbiddenException for students or parents', async () => {
            await expect(service.getMarksByClass('class-1', 1, 2026, studentCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('should fetch marks for authorized admin caller filtering by year and term', async () => {
            mockDb.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'mark-1' }], error: null }));
            const result = await service.getMarksByClass('class-1', 1, 2026, adminCaller);
            expect(result).toHaveLength(1);
            expect(mockDb.eq).toHaveBeenCalledWith('academic_year', 2026);
            expect(mockDb.eq).toHaveBeenCalledWith('term', '1');
        });

        it('should verify teacher assignment when caller is teacher', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'teacher-id' }, error: null });
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'assignment-id' }, error: null });
            mockDb.then.mockImplementationOnce((resolve: any) => resolve({ data: [{ id: 'mark-1' }], error: null }));

            const result = await service.getMarksByClass('class-1', 1, 2026, teacherCaller);
            expect(result).toHaveLength(1);
        });
    });

    describe('finalizeTerm and reopenTerm', () => {
        const teacherCaller = { sub: 'teacher-user-id', role: UserRole.TEACHER, tenantId: 'tenant-1' } as any;
        const adminCaller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;

        it('should allow teacher to finalize term for assigned class', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'teacher-id' }, error: null });
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'assignment-id' }, error: null });
            mockDb.single.mockResolvedValueOnce({ data: { id: 'fin-1', is_finalized: true }, error: null });

            const result = await service.finalizeTerm('class-1', 1, 2026, teacherCaller);
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should allow school admin to reopen term', async () => {
            mockDb.single.mockResolvedValueOnce({ data: { id: 'fin-1', is_finalized: false }, error: null });

            const result = await service.reopenTerm('class-1', 1, 2026, adminCaller);
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
        });

        it('should reject reopening term if caller is teacher', async () => {
            await expect(service.reopenTerm('class-1', 1, 2026, teacherCaller))
                .rejects.toThrow(ForbiddenException);
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
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'other-student-id' }, error: null });
            await expect(service.getMarksByStudent('student-1', studentCaller)).rejects.toThrow(ForbiddenException);
        });

        it('should return marks for student accessing their own marks', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { user_id: 'student-id' }, error: null });
            mockDb.then.mockImplementationOnce((resolve: any) => resolve(mockMarksReturn));
            const result = await service.getMarksByStudent('student-1', studentCaller);
            expect(result).toHaveLength(1);
        });

        it('should throw ForbiddenException for parent accessing unlinked student marks', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

            await expect(service.getMarksByStudent('student-1', parentCaller)).rejects.toThrow(ForbiddenException);
        });

        it('should return marks for parent accessing linked student', async () => {
            mockDb.maybeSingle.mockResolvedValueOnce({ data: { id: 'pc-1' }, error: null });
            mockDb.then.mockImplementationOnce((resolve: any) => resolve(mockMarksReturn));

            const result = await service.getMarksByStudent('student-1', parentCaller);
            expect(result).toHaveLength(1);
        });
    });
});
