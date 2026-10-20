import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';

import { SupabaseService, assertUuid } from '../supabase/supabase.service';

import type { CreateHomeworkDto, SubmitHomeworkDto, GradeHomeworkDto } from './dto/homework.dto';

@Injectable()
export class HomeworkService {
    private readonly logger = new Logger(HomeworkService.name);

    constructor(private readonly supabase: SupabaseService) { }

    private async getTeacherClassIds(caller: JwtPayload): Promise<string[]> {
        const { data: tRec } = await this.supabase.adminClient
            .from('teachers')
            .select('id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        if (!tRec?.id) return [];

        const { data: ctRows } = await this.supabase.adminClient
            .from('class_teachers')
            .select('class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('teacher_id', tRec.id);

        return (ctRows ?? []).map((ct: any) => ct.class_id).filter(Boolean);
    }

    private async getStudentClassId(caller: JwtPayload): Promise<string | null> {
        const { data: sRec } = await this.supabase.adminClient
            .from('students')
            .select('class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        return sRec?.class_id ?? null;
    }

    private async getParentChildrenClassIds(caller: JwtPayload): Promise<string[]> {
        const { data: pRows } = await this.supabase.adminClient
            .from('parents')
            .select('student_id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub);

        const studentIds = (pRows ?? []).map((r: any) => r.student_id).filter(Boolean);
        if (studentIds.length === 0) return [];

        const { data: sRows } = await this.supabase.adminClient
            .from('students')
            .select('class_id')
            .in('id', studentIds);

        return (sRows ?? []).map((s: any) => s.class_id).filter(Boolean);
    }

    async listTasks(caller: JwtPayload, classId?: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const client = this.supabase.adminClient;
        let query = client
            .from('homework_tasks')
            .select('*, classes(id, name, grade)')
            .eq('tenant_id', caller.tenantId)
            .is('deleted_at', null)
            .order('due_date', { ascending: true });

        if (classId) {
            assertUuid(classId, 'classId');
            query = query.eq('class_id', classId);
        }

        if (caller.role === UserRole.TEACHER) {
            const teacherClasses = await this.getTeacherClassIds(caller);
            if (teacherClasses.length === 0) {
                return [];
            }
            if (classId) {
                if (!teacherClasses.includes(classId)) {
                    throw new ForbiddenException('Teacher not assigned to this class');
                }
            } else {
                query = query.in('class_id', teacherClasses);
            }
        } else if (caller.role === UserRole.STUDENT) {
            const studentClassId = await this.getStudentClassId(caller);
            if (!studentClassId) return [];
            query = query.eq('class_id', studentClassId);
        } else if (caller.role === UserRole.PARENT) {
            const childrenClassIds = await this.getParentChildrenClassIds(caller);
            if (childrenClassIds.length === 0) return [];
            query = query.in('class_id', childrenClassIds);
        }

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to list homework tasks: ${error.message}`);
            return [];
        }

        // For students, attach their submission status if submitted
        if (caller.role === UserRole.STUDENT && data && data.length > 0) {
            const taskIds = data.map((t: any) => t.id);
            const { data: submissions } = await client
                .from('homework_submissions')
                .select('*')
                .eq('tenant_id', caller.tenantId)
                .eq('student_id', caller.sub)
                .in('homework_id', taskIds);

            const submissionMap = new Map((submissions ?? []).map((s: any) => [s.homework_id, s]));
            return data.map((t: any) => ({
                ...t,
                mySubmission: submissionMap.get(t.id) ?? null,
            }));
        }

        // For parents, attach their children's submissions if submitted
        if (caller.role === UserRole.PARENT && data && data.length > 0) {
            const { data: pRows } = await client
                .from('parents')
                .select('student_id, students(id, user_id, users(full_name))')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub);

            const pRowsAny: any[] = (pRows as any) ?? [];
            const studentUserIds = pRowsAny
                .map((p) => {
                    const stu = Array.isArray(p.students) ? p.students[0] : p.students;
                    return stu?.user_id;
                })
                .filter(Boolean);
            const studentNameMap = new Map<string, string>();
            for (const p of pRowsAny) {
                const stu = Array.isArray(p.students) ? p.students[0] : p.students;
                const usr = Array.isArray(stu?.users) ? stu?.users[0] : stu?.users;
                if (stu?.user_id) {
                    studentNameMap.set(stu.user_id, usr?.full_name || 'Child');
                }
                if (p.student_id) {
                    studentNameMap.set(p.student_id, usr?.full_name || 'Child');
                }
            }

            if (studentUserIds.length > 0) {
                const taskIds = data.map((t: any) => t.id);
                const { data: submissions } = await client
                    .from('homework_submissions')
                    .select('*')
                    .eq('tenant_id', caller.tenantId)
                    .in('student_id', studentUserIds)
                    .in('homework_id', taskIds);

                const subByTask = new Map<string, any[]>();
                for (const sub of submissions ?? []) {
                    const list = subByTask.get(sub.homework_id) || [];
                    list.push({
                        ...sub,
                        studentName: studentNameMap.get(sub.student_id) || 'Child',
                    });
                    subByTask.set(sub.homework_id, list);
                }

                return data.map((t: any) => ({
                    ...t,
                    childSubmissions: subByTask.get(t.id) ?? [],
                }));
            }
        }

        return data ?? [];
    }

    async getTaskById(id: string, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(id, 'id');

        const { data, error } = await this.supabase.adminClient
            .from('homework_tasks')
            .select('*, classes(id, name, grade)')
            .eq('tenant_id', caller.tenantId)
            .eq('id', id)
            .is('deleted_at', null)
            .maybeSingle();

        if (error || !data) {
            throw new NotFoundException(`Homework task ${id} not found`);
        }

        // Check student submission
        if (caller.role === UserRole.STUDENT) {
            const { data: sub } = await this.supabase.adminClient
                .from('homework_submissions')
                .select('*')
                .eq('tenant_id', caller.tenantId)
                .eq('homework_id', id)
                .eq('student_id', caller.sub)
                .maybeSingle();

            return { ...data, mySubmission: sub ?? null };
        }

        // Check parent's children submissions
        if (caller.role === UserRole.PARENT) {
            const { data: pRows } = await this.supabase.adminClient
                .from('parents')
                .select('student_id, students(id, user_id, users(full_name))')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub);

            const pRowsAny: any[] = (pRows as any) ?? [];
            const studentUserIds = pRowsAny
                .map((p) => {
                    const stu = Array.isArray(p.students) ? p.students[0] : p.students;
                    return stu?.user_id;
                })
                .filter(Boolean);
            const studentNameMap = new Map<string, string>();
            for (const p of pRowsAny) {
                const stu = Array.isArray(p.students) ? p.students[0] : p.students;
                const usr = Array.isArray(stu?.users) ? stu?.users[0] : stu?.users;
                if (stu?.user_id) {
                    studentNameMap.set(stu.user_id, usr?.full_name || 'Child');
                }
                if (p.student_id) {
                    studentNameMap.set(p.student_id, usr?.full_name || 'Child');
                }
            }

            if (studentUserIds.length > 0) {
                const { data: submissions } = await this.supabase.adminClient
                    .from('homework_submissions')
                    .select('*')
                    .eq('tenant_id', caller.tenantId)
                    .in('student_id', studentUserIds)
                    .eq('homework_id', id);

                return {
                    ...data,
                    childSubmissions: (submissions ?? []).map((sub: any) => ({
                        ...sub,
                        studentName: studentNameMap.get(sub.student_id) || 'Child',
                    })),
                };
            }
        }

        return data;
    }

    async createTask(dto: CreateHomeworkDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(dto.classId, 'classId');

        if (caller.role !== UserRole.TEACHER && caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and school administrators can assign homework');
        }

        if (caller.role === UserRole.TEACHER) {
            const teacherClasses = await this.getTeacherClassIds(caller);
            if (!teacherClasses.includes(dto.classId)) {
                throw new ForbiddenException('Teachers can only create homework for their assigned classes');
            }
        }

        const { data, error } = await this.supabase.adminClient
            .from('homework_tasks')
            .insert({
                tenant_id: caller.tenantId,
                class_id: dto.classId,
                teacher_id: caller.sub,
                title: dto.title,
                description: dto.description,
                due_date: dto.dueDate,
                attachments: dto.attachments ?? [],
            })
            .select()
            .single();

        if (error || !data) {
            this.logger.error(`Failed to insert homework task: ${error?.message}`);
            throw new BadRequestException('Failed to create homework task');
        }

        return data;
    }

    async submitTask(homeworkId: string, dto: SubmitHomeworkDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(homeworkId, 'homeworkId');

        if (caller.role !== UserRole.STUDENT) {
            throw new ForbiddenException('Only students can submit homework solutions');
        }

        // Verify task exists and caller belongs to assigned class
        const { data: task, error: taskErr } = await this.supabase.adminClient
            .from('homework_tasks')
            .select('id, class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('id', homeworkId)
            .is('deleted_at', null)
            .maybeSingle();

        if (taskErr || !task) {
            throw new NotFoundException(`Homework task ${homeworkId} not found`);
        }

        const studentClassId = await this.getStudentClassId(caller);
        if (studentClassId !== task.class_id) {
            throw new ForbiddenException('Student does not belong to the class assigned this homework');
        }

        // Upsert submission
        const client = this.supabase.adminClient;
        const now = new Date().toISOString();

        const { data: existingSub } = await client
            .from('homework_submissions')
            .select('id')
            .eq('tenant_id', caller.tenantId)
            .eq('homework_id', homeworkId)
            .eq('student_id', caller.sub)
            .maybeSingle();

        let result;
        if (existingSub) {
            const { data, error } = await client
                .from('homework_submissions')
                .update({
                    content: dto.content,
                    attachments: dto.attachments ?? [],
                    submitted_at: now,
                    status: 'SUBMITTED',
                    client_uuid: dto.clientUuid,
                    updated_at: now,
                })
                .eq('id', existingSub.id)
                .select()
                .single();
            if (error) throw new BadRequestException(`Failed to update homework submission: ${error.message}`);
            result = data;
        } else {
            const { data, error } = await client
                .from('homework_submissions')
                .insert({
                    tenant_id: caller.tenantId,
                    homework_id: homeworkId,
                    student_id: caller.sub,
                    content: dto.content,
                    attachments: dto.attachments ?? [],
                    submitted_at: now,
                    status: 'SUBMITTED',
                    client_uuid: dto.clientUuid,
                })
                .select()
                .single();
            if (error) throw new BadRequestException(`Failed to submit homework: ${error.message}`);
            result = data;
        }

        return result;
    }

    async getSubmissions(homeworkId: string, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(homeworkId, 'homeworkId');

        if (caller.role !== UserRole.TEACHER && caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and school administrators can view submissions');
        }

        if (caller.role === UserRole.TEACHER) {
            const { data: task, error: taskError } = await this.supabase.adminClient
                .from('homework_tasks')
                .select('class_id')
                .eq('tenant_id', caller.tenantId)
                .eq('id', homeworkId)
                .maybeSingle();

            if (taskError || !task) {
                throw new NotFoundException(`Homework task ${homeworkId} not found`);
            }

            const teacherClasses = await this.getTeacherClassIds(caller);
            if (!teacherClasses.includes(task.class_id)) {
                throw new ForbiddenException('Teachers can only view submissions for their assigned classes');
            }
        }

        const { data, error } = await this.supabase.adminClient
            .from('homework_submissions')
            .select('*, users!student_id(id, full_name, email)')
            .eq('tenant_id', caller.tenantId)
            .eq('homework_id', homeworkId)
            .order('submitted_at', { ascending: false });

        if (error) {
            this.logger.error(`Failed to fetch submissions: ${error.message}`);
            return [];
        }

        return data ?? [];
    }

    async gradeSubmission(submissionId: string, dto: GradeHomeworkDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(submissionId, 'submissionId');

        if (caller.role !== UserRole.TEACHER && caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and school administrators can grade submissions');
        }

        if (caller.role === UserRole.TEACHER) {
            const { data: sub, error: subErr } = await this.supabase.adminClient
                .from('homework_submissions')
                .select('homework_id')
                .eq('tenant_id', caller.tenantId)
                .eq('id', submissionId)
                .maybeSingle();

            if (subErr || !sub) {
                throw new NotFoundException(`Homework submission ${submissionId} not found`);
            }

            const { data: task, error: taskErr } = await this.supabase.adminClient
                .from('homework_tasks')
                .select('class_id')
                .eq('tenant_id', caller.tenantId)
                .eq('id', sub.homework_id)
                .maybeSingle();

            if (taskErr || !task) {
                throw new NotFoundException(`Homework task for submission not found`);
            }

            const teacherClasses = await this.getTeacherClassIds(caller);
            if (!teacherClasses.includes(task.class_id)) {
                throw new ForbiddenException('Teachers can only grade submissions for their assigned classes');
            }
        }

        const { data, error } = await this.supabase.adminClient
            .from('homework_submissions')
            .update({
                grade: dto.grade,
                feedback: dto.feedback,
                status: dto.status ?? 'GRADED',
                updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', caller.tenantId)
            .eq('id', submissionId)
            .select()
            .single();

        if (error || !data) {
            throw new NotFoundException(`Homework submission ${submissionId} not found`);
        }

        return data;
    }
}
