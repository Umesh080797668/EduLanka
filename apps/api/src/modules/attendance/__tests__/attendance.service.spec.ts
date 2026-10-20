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
    let mockUpsert: any;

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
        mockUpsert = jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'att-1',
                        tenant_id: tenantUuid,
                        class_id: classUuid,
                        student_id: studentUserUuid,
                        date: '2026-10-15',
                        period: 1,
                        status: 'PRESENT',
                    },
                ],
                error: null,
            }),
        });

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
                    const chain: any = {
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
                        then: (resolve: any) => resolve({
                            data: [
                                {
                                    id: 'student-rec-1',
                                    user_id: studentUserUuid,
                                    admission_number: 'ADM-001',
                                },
                            ],
                            error: null,
                        }),
                    };
                    return chain;
                }
                if (table === 'attendance') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        in: jest.fn().mockReturnThis(),
                        order: jest.fn().mockReturnThis(),
                        upsert: mockUpsert,
                        then: (resolve: any) => resolve({
                            data: [
                                {
                                    id: 'att-1',
                                    student_id: studentUserUuid,
                                    status: 'PRESENT',
                                    period: 1,
                                    marked_at: '2026-10-15T08:00:00Z',
                                    marked_by: teacherUuid,
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === 'attendance_conflicts_log') {
                    return {
                        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
                    };
                }
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
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
            expect(result.period).toBe(1);
        });

        it('allows querying attendance by specific period', async () => {
            const result = await service.getAttendance(teacherCaller, classUuid, '2026-10-15', 2);
            expect(result).toBeDefined();
            expect(result.period).toBe(2);
            expect(result.students[0].period).toBe(2);
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
            expect(result.period).toBe(1);
            expect(mockAdminClient.rpc).toHaveBeenCalledWith('append_sync_event', expect.objectContaining({
                p_entity_type: 'attendance',
                p_tenant_id: tenantUuid,
            }));
        });

        it('records attendance for specific period (period 2) without overwriting', async () => {
            const result = await service.recordAttendance(teacherCaller, {
                classId: classUuid,
                date: '2026-10-15',
                period: 2,
                records: [{ studentId: studentUserUuid, status: 'LATE' }],
            });

            expect(result.success).toBe(true);
            expect(result.period).toBe(2);
            expect(mockUpsert).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        period: 2,
                        status: 'LATE',
                    }),
                ]),
                expect.objectContaining({ onConflict: 'tenant_id,class_id,student_id,date,period' }),
            );
        });

        it('rejects recording attendance for students not enrolled in the class', async () => {
            const unenrolledStudentUuid = '88888888-8888-8888-8888-888888888888';
            await expect(
                service.recordAttendance(teacherCaller, {
                    classId: classUuid,
                    date: '2026-10-15',
                    period: 1,
                    records: [{ studentId: unenrolledStudentUuid, status: 'PRESENT' }],
                }),
            ).rejects.toThrow(BadRequestException);
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

        it('logs conflict to attendance_conflicts_log when updating attendance with conflicting status', async () => {
            const conflictInsert = jest.fn().mockResolvedValue({ data: null, error: null });
            mockAdminClient.from.mockImplementation((table: string) => {
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
                        then: (resolve: any) => resolve({ data: [{ class_id: classUuid }], error: null }),
                    };
                }
                if (table === 'students') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        then: (resolve: any) => resolve({
                            data: [{ id: 'student-rec-1', user_id: studentUserUuid }],
                            error: null,
                        }),
                    };
                }
                if (table === 'attendance') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        in: jest.fn().mockReturnThis(),
                        upsert: mockUpsert,
                        then: (resolve: any) => resolve({
                            data: [
                                {
                                    id: 'att-1',
                                    student_id: studentUserUuid,
                                    status: 'PRESENT',
                                    period: 1,
                                    marked_at: '2026-10-15T08:00:00Z',
                                },
                            ],
                            error: null,
                        }),
                    };
                }
                if (table === 'attendance_conflicts_log') {
                    return { insert: conflictInsert };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await service.recordAttendance(teacherCaller, {
                classId: classUuid,
                date: '2026-10-15',
                period: 1,
                records: [{ studentId: studentUserUuid, status: 'ABSENT' }],
            });

            expect(conflictInsert).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        conflict_date: '2026-10-15',
                        student_id: studentUserUuid,
                        client_state: expect.objectContaining({ status: 'ABSENT' }),
                        server_state: expect.objectContaining({ status: 'PRESENT' }),
                        resolution: 'CLIENT_WINS',
                    }),
                ]),
            );
        });
    });

    describe('getMyAttendance and getStudentAttendance', () => {
        it('should allow student to fetch their own attendance with summary metrics', () => {
            const mockQuery = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'stu-uuid-1',
                        user_id: studentUserUuid,
                        admission_no: '2026/0001',
                        class_id: classUuid,
                    },
                    error: null,
                }),
                then: (resolve: any) =>
                    resolve({
                        data: [
                            { id: 'att-1', student_id: studentUserUuid, status: 'PRESENT', date: '2026-10-15', period: 1 },
                            { id: 'att-2', student_id: studentUserUuid, status: 'ABSENT', date: '2026-10-14', period: 1 },
                        ],
                        error: null,
                    }),
            };

            mockAdminClient.from.mockReturnValue(mockQuery);

            return service.getMyAttendance(studentCaller).then((res) => {
                expect(res.records).toHaveLength(2);
                expect(res.summary.total).toBe(2);
                expect(res.summary.present).toBe(1);
                expect(res.summary.absent).toBe(1);
                expect(res.summary.attendancePercentage).toBe(50);
            });
        });

        it('should allow linked parent to fetch their child attendance', async () => {
            const parentCaller: JwtPayload = {
                sub: '66666666-6666-6666-6666-666666666666',
                tenantId: tenantUuid,
                email: 'parent@school.lk',
                role: UserRole.PARENT,
            };

            const studentEntityUuid = '88888888-8888-8888-8888-888888888888';

            mockAdminClient.from.mockImplementation((table: string) => {
                if (table === 'students') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        or: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: studentEntityUuid,
                                user_id: studentUserUuid,
                                admission_no: '2026/0001',
                                class_id: classUuid,
                                users: { full_name: 'Student One', email: 's1@school.lk' },
                            },
                            error: null,
                        }),
                    };
                }
                if (table === 'parents') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: { id: 'parent-link-id' },
                            error: null,
                        }),
                    };
                }
                if (table === 'attendance') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        in: jest.fn().mockReturnThis(),
                        is: jest.fn().mockReturnThis(),
                        order: jest.fn().mockReturnThis(),
                        gte: jest.fn().mockReturnThis(),
                        lte: jest.fn().mockReturnThis(),
                        then: (resolve: any) =>
                            resolve({
                                data: [
                                    { id: 'att-1', student_id: studentUserUuid, status: 'PRESENT', date: '2026-10-15', period: 1 },
                                ],
                                error: null,
                            }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            const res = await service.getStudentAttendance(parentCaller, studentEntityUuid);
            expect(res.records).toHaveLength(1);
            expect(res.student.admission_no).toBe('2026/0001');
            expect(res.summary.present).toBe(1);
        });

        it('should reject unlinked parent from fetching attendance', async () => {
            const parentCaller: JwtPayload = {
                sub: '77777777-7777-7777-7777-777777777777',
                tenantId: tenantUuid,
                email: 'parent@school.lk',
                role: UserRole.PARENT,
            };

            const studentEntityUuid = '88888888-8888-8888-8888-888888888888';

            mockAdminClient.from.mockImplementation((table: string) => {
                if (table === 'students') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        or: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: studentEntityUuid,
                                user_id: studentUserUuid,
                                admission_no: '2026/0001',
                                class_id: classUuid,
                                users: { full_name: 'Student One', email: 's1@school.lk' },
                            },
                            error: null,
                        }),
                    };
                }
                if (table === 'parents') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    };
                }
                return { select: jest.fn().mockReturnThis() };
            });

            await expect(
                service.getStudentAttendance(parentCaller, studentEntityUuid),
            ).rejects.toThrow(ForbiddenException);
        });
    });
});
