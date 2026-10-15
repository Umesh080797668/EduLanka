import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { HomeworkService } from '../homework.service';

describe('HomeworkService', () => {
    let service: HomeworkService;
    let mockSupabase: any;

    const teacherCaller: JwtPayload = {
        sub: '11111111-1111-1111-1111-111111111111',
        tenantId: '22222222-2222-2222-2222-222222222222',
        role: UserRole.TEACHER,
        email: 'teacher@edulanka.lk',
    };

    const studentCaller: JwtPayload = {
        sub: '33333333-3333-3333-3333-333333333333',
        tenantId: '22222222-2222-2222-2222-222222222222',
        role: UserRole.STUDENT,
        email: 'student@edulanka.lk',
    };

    const classUuid = '44444444-4444-4444-4444-444444444444';
    const homeworkUuid = '55555555-5555-5555-5555-555555555555';

    beforeEach(async () => {
        mockSupabase = {
            adminClient: {
                from: jest.fn(),
            },
        };

        const module = await Test.createTestingModule({
            providers: [
                HomeworkService,
                { provide: SupabaseService, useValue: mockSupabase },
            ],
        }).compile();

        service = module.get<HomeworkService>(HomeworkService);
    });

    it('should allow teacher to assign homework to their assigned class', async () => {
        // Teacher class assignment check
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'teachers') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                };
            }
            if (table === 'class_teachers') {
                const chain: any = {};
                chain.select = jest.fn().mockReturnValue(chain);
                chain.eq = jest.fn().mockImplementation(() => chain);
                chain.then = (resolve: any) => resolve({ data: [{ class_id: classUuid }] });
                return chain;
            }
            if (table === 'homework_tasks') {
                return {
                    insert: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: homeworkUuid,
                            class_id: classUuid,
                            title: 'Algebra Worksheet 1',
                        },
                        error: null,
                    }),
                };
            }
            return { select: jest.fn().mockReturnThis() };
        });

        const result = await service.createTask(
            {
                classId: classUuid,
                title: 'Algebra Worksheet 1',
                description: 'Solve problems 1-10',
                dueDate: '2026-10-20T10:00:00Z',
            },
            teacherCaller,
        );

        expect(result.id).toBe(homeworkUuid);
        expect(result.title).toBe('Algebra Worksheet 1');
    });

    it('should reject teacher assigning homework to an unassigned class', async () => {
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'teachers') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                };
            }
            if (table === 'class_teachers') {
                const chain: any = {};
                chain.select = jest.fn().mockReturnValue(chain);
                chain.eq = jest.fn().mockImplementation(() => chain);
                chain.then = (resolve: any) => resolve({ data: [{ class_id: 'other-class-uuid' }] });
                return chain;
            }
            return { select: jest.fn().mockReturnThis() };
        });

        await expect(
            service.createTask(
                {
                    classId: classUuid,
                    title: 'Science Homework',
                    description: 'Read Chapter 4',
                    dueDate: '2026-10-20T10:00:00Z',
                },
                teacherCaller,
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject student creating homework tasks', async () => {
        await expect(
            service.createTask(
                {
                    classId: classUuid,
                    title: 'Unauthorized Task',
                    description: 'Test',
                    dueDate: '2026-10-20T10:00:00Z',
                },
                studentCaller,
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should allow student to submit homework solution for their class', async () => {
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'homework_tasks') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    is: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: homeworkUuid, class_id: classUuid },
                        error: null,
                    }),
                };
            }
            if (table === 'students') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { class_id: classUuid },
                    }),
                };
            }
            if (table === 'homework_submissions') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: null }),
                    insert: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: 'sub-1',
                            homework_id: homeworkUuid,
                            student_id: studentCaller.sub,
                            status: 'SUBMITTED',
                        },
                        error: null,
                    }),
                };
            }
            return { select: jest.fn().mockReturnThis() };
        });

        const sub = await service.submitTask(
            homeworkUuid,
            { content: 'Here is my homework solution.' },
            studentCaller,
        );

        expect(sub.status).toBe('SUBMITTED');
        expect(sub.homework_id).toBe(homeworkUuid);
    });

    it('should reject student submitting homework for another class', async () => {
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'homework_tasks') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    is: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: homeworkUuid, class_id: classUuid },
                        error: null,
                    }),
                };
            }
            if (table === 'students') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { class_id: 'different-class-uuid' },
                    }),
                };
            }
            return { select: jest.fn().mockReturnThis() };
        });

        await expect(
            service.submitTask(homeworkUuid, { content: 'Solution' }, studentCaller),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should allow teacher to grade homework submission for assigned class', async () => {
        const subUuid = '66666666-6666-6666-6666-666666666666';
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'homework_submissions') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { homework_id: homeworkUuid },
                    }),
                    update: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: subUuid,
                            grade: 'A',
                            feedback: 'Excellent work!',
                            status: 'GRADED',
                        },
                        error: null,
                    }),
                };
            }
            if (table === 'homework_tasks') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { class_id: classUuid },
                    }),
                };
            }
            if (table === 'teachers') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                };
            }
            if (table === 'class_teachers') {
                const chain: any = {};
                chain.select = jest.fn().mockReturnValue(chain);
                chain.eq = jest.fn().mockImplementation(() => chain);
                chain.then = (resolve: any) => resolve({ data: [{ class_id: classUuid }] });
                return chain;
            }
            return { select: jest.fn().mockReturnThis() };
        });

        const graded = await service.gradeSubmission(
            subUuid,
            { grade: 'A', feedback: 'Excellent work!' },
            teacherCaller,
        );

        expect(graded.grade).toBe('A');
        expect(graded.status).toBe('GRADED');
    });

    it('should reject teacher grading homework for an unassigned class', async () => {
        const subUuid = '66666666-6666-6666-6666-666666666666';
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'homework_submissions') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { homework_id: homeworkUuid },
                    }),
                };
            }
            if (table === 'homework_tasks') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { class_id: 'different-class-uuid' },
                    }),
                };
            }
            if (table === 'teachers') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                };
            }
            if (table === 'class_teachers') {
                const chain: any = {};
                chain.select = jest.fn().mockReturnValue(chain);
                chain.eq = jest.fn().mockImplementation(() => chain);
                chain.then = (resolve: any) => resolve({ data: [{ class_id: classUuid }] });
                return chain;
            }
            return { select: jest.fn().mockReturnThis() };
        });

        await expect(
            service.gradeSubmission(
                subUuid,
                { grade: 'A', feedback: 'Work' },
                teacherCaller,
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject teacher viewing submissions for an unassigned class', async () => {
        mockSupabase.adminClient.from.mockImplementation((table: string) => {
            if (table === 'homework_tasks') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { class_id: 'unassigned-class-uuid' },
                    }),
                };
            }
            if (table === 'teachers') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'teacher-rec-1' } }),
                };
            }
            if (table === 'class_teachers') {
                const chain: any = {};
                chain.select = jest.fn().mockReturnValue(chain);
                chain.eq = jest.fn().mockImplementation(() => chain);
                chain.then = (resolve: any) => resolve({ data: [{ class_id: classUuid }] });
                return chain;
            }
            return { select: jest.fn().mockReturnThis() };
        });

        await expect(
            service.getSubmissions(homeworkUuid, teacherCaller),
        ).rejects.toThrow(ForbiddenException);
    });
});
