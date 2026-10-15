import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { SupabaseService } from '../../supabase/supabase.service';
import { AttendanceService } from '../attendance.service';

describe('AttendanceService', () => {
    let service: AttendanceService;
    let mockSupabase: any;
    let mockAdminClient: any;

    const tenantUuid = '11111111-1111-1111-1111-111111111111';
    const teacherUuid = '22222222-2222-2222-2222-222222222222';
    const studentUserUuid = '33333333-3333-3333-3333-333333333333';
    const classUuid = '44444444-4444-4444-4444-444444444444';
    const unassignedClassUuid = '99999999-9999-9999-9999-999999999999';

    const teacherCaller: JwtPayload = {
        sub: teacherUuid,
        tenantId: tenantUuid,
        email: 'teacher@school.lk',
        role: UserRole.TEACHER,
    };

    const studentCaller: JwtPayload = {
        sub: studentUserUuid,
        tenantId: tenantUuid,
        email: 'student@school.lk',
        role: UserRole.STUDENT,
    };

    const adminCaller: JwtPayload = {
        sub: '55555555-5555-5555-5555-555555555555',
        tenantId: tenantUuid,
        email: 'admin@school.lk',
        role: UserRole.SCHOOL_ADMIN,
    };

    beforeEach(async () => {
        mockAdminClient = {
            from: jest.fn().mockImplementation((table: string) => {
                if (table === 'teachers') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: 'teacher-rec-1' },
                            error: null,
                        }),
                    };
                }
                if (table === 'class_teachers') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                        then: (resolve: any) => resolve({ data: [{ class_id: classUuid }], error: null }),
                    };
                }
                if (table === 'classes') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: classUuid, name: 'Grade 10A', grade: 10 },
                            error: null,
                        }),
                    };
                }
                if (table === 'students') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        order: jest.fn().mockResolvedValue({
                            data: [
                                {
                                    id: 'student-rec-1',
                                    user_id: studentUserUuid,
                                    admission_number: 'ADM-001',
                                    users: {
                                        id: studentUserUuid,
                                        full_name: 'Nimal Perera',
                                        email: 'nimal@school.lk',
                                    },
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === 'attendance') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        order: jest.fn().mockReturnThis(),
                        upsert: jest.fn().mockReturnValue({
                            select: jest.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: 'att-1',
                                        tenant_id: tenantUuid,
                                        class_id: classUuid,
                                        student_id: studentUserUuid,
                                        date: '2026-10-15',
                                        status: 'PRESENT',
                                    },
                                ],
                                error: null,
                            }),
                        }),
                        then: (resolve: any) => resolve({
                            data: [
                                {
                                    id: 'att-1',
                                    student_id: studentUserUuid,
                                    status: 'PRESENT',
                                    marked_at: '2026-10-15T08:00:00Z',
                                    marked_by: teacherUuid,
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                };
            }),
            rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockSupabase = { adminClient: mockAdminClient };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AttendanceService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<AttendanceService>(AttendanceService);
    });

    describe('getAttendance', () => {
        it('allows teacher to retrieve class roster and attendance for assigned class', async () => {
            const result = await service.getAttendance(teacherCaller, classUuid, '2026-10-15');

            expect(result).toBeDefined();
            expect(result.class.name).toBe('Grade 10A');
            expect(result.students.length).toBe(1);
            expect(result.students[0].fullName).toBe('Nimal Perera');
            expect(result.students[0].status).toBe('PRESENT');
            expect(result.summary.present).toBe(1);
            expect(result.summary.attendanceRate).toBe(100);
        });

        it('rejects teacher from accessing attendance for unassigned class', async () => {
            await expect(
                service.getAttendance(teacherCaller, unassignedClassUuid, '2026-10-15'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('allows School Admin to view attendance for any class', async () => {
            const result = await service.getAttendance(adminCaller, unassignedClassUuid, '2026-10-15');
            expect(result).toBeDefined();
        });

        it('rejects student from querying class attendance roll call', async () => {
            await expect(
                service.getAttendance(studentCaller, classUuid, '2026-10-15'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('recordAttendance', () => {
        it('allows teacher to mark roll call and emits sync events', async () => {
            const result = await service.recordAttendance(teacherCaller, {
                classId: classUuid,
                date: '2026-10-15',
                records: [
                    { studentId: studentUserUuid, status: 'PRESENT' },
                ],
            });

            expect(result.success).toBe(true);
            expect(result.savedCount).toBe(1);
            expect(mockAdminClient.rpc).toHaveBeenCalledWith('append_sync_event', expect.objectContaining({
                p_entity_type: 'attendance',
                p_tenant_id: tenantUuid,
            }));
        });

        it('rejects teacher from recording attendance for unassigned class', async () => {
            await expect(
                service.recordAttendance(teacherCaller, {
                    classId: unassignedClassUuid,
                    date: '2026-10-15',
                    records: [{ studentId: studentUserUuid, status: 'PRESENT' }],
                }),
            ).rejects.toThrow(ForbiddenException);
        });

        it('rejects empty attendance submissions', async () => {
            await expect(
                service.recordAttendance(teacherCaller, {
                    classId: classUuid,
                    date: '2026-10-15',
                    records: [],
                }),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
