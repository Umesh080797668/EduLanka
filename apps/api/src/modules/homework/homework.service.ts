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
import { v2 as cloudinary } from 'cloudinary';

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
                .select('student_id')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub);

            const studentIds = (pRows ?? []).map((p: any) => p.student_id).filter(Boolean);
            if (studentIds.length > 0) {
                const { data: studentsData } = await client
                    .from('students')
                    .select('id, user_id, users(full_name)')
                    .eq('tenant_id', caller.tenantId)
                    .in('id', studentIds);

                const studentUserIds = (studentsData ?? [])
                    .map((s: any) => s.user_id)
                    .filter(Boolean);

                const studentNameMap = new Map<string, string>();
                for (const s of (studentsData ?? []) as any[]) {
                    const usr = Array.isArray(s.users) ? s.users[0] : s.users;
                    const name = usr?.full_name || 'Child';
                    if (s.user_id) studentNameMap.set(s.user_id, name);
                    if (s.id) studentNameMap.set(s.id, name);
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
                .select('student_id')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub);

            const studentIds = (pRows ?? []).map((p: any) => p.student_id).filter(Boolean);
            if (studentIds.length > 0) {
                const { data: studentsData } = await this.supabase.adminClient
                    .from('students')
                    .select('id, user_id, users(full_name)')
                    .eq('tenant_id', caller.tenantId)
                    .in('id', studentIds);

                const studentUserIds = (studentsData ?? [])
                    .map((s: any) => s.user_id)
                    .filter(Boolean);

                const studentNameMap = new Map<string, string>();
                for (const s of (studentsData ?? []) as any[]) {
                    const usr = Array.isArray(s.users) ? s.users[0] : s.users;
                    const name = usr?.full_name || 'Child';
                    if (s.user_id) studentNameMap.set(s.user_id, name);
                    if (s.id) studentNameMap.set(s.id, name);
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

    async uploadHomeworkAttachment(file: any, caller: JwtPayload) {
        if (!file) {
            throw new BadRequestException('No file provided for upload');
        }

        const filename = file.originalname || file.filename || 'attachment';
        const mimetype = String(file.mimetype || file.mimeType || '').toLowerCase();
        let size = typeof file.size === 'number' ? file.size : 0;

        if (!size && file.buffer) {
            size = file.buffer.length;
        } else if (!size && file.base64) {
            size = Buffer.from(file.base64, 'base64').length;
        }

        // 1. File size validation: maximum 10MB limit
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (size <= 0) {
            throw new BadRequestException('Attachment file cannot be empty');
        }
        if (size > MAX_FILE_SIZE) {
            throw new BadRequestException('Attachment file size exceeds maximum 10MB limit');
        }

        // 2. MIME-type validation
        const ALLOWED_MIME_TYPES = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
        ];

        if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
            throw new BadRequestException(
                `Invalid attachment MIME type: "${mimetype}". Allowed types: PDF, PNG, JPEG, WEBP, DOC, DOCX, PPT, PPTX, TXT`,
            );
        }

        // 3. Attempt Cloudinary upload if storage credentials configured
        const secret = process.env.CLOUDINARY_API_SECRET;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        if (secret && apiKey && cloudName) {
            try {
                const folder = caller?.tenantId ? `edulanka/${caller.tenantId}/homework` : 'edulanka/homework';
                let uploadResult: any;

                if (file.buffer) {
                    uploadResult = await new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder, resource_type: 'auto' },
                            (err, res) => (err ? reject(err) : resolve(res)),
                        );
                        stream.end(file.buffer);
                    });
                } else if (file.base64) {
                    const dataUri = file.base64.startsWith('data:')
                        ? file.base64
                        : `data:${mimetype};base64,${file.base64}`;
                    uploadResult = await cloudinary.uploader.upload(dataUri, { folder, resource_type: 'auto' });
                } else if (file.path) {
                    uploadResult = await cloudinary.uploader.upload(file.path, { folder, resource_type: 'auto' });
                }

                if (uploadResult) {
                    return {
                        url: uploadResult.secure_url || uploadResult.url,
                        publicId: uploadResult.public_id,
                        filename,
                        mimetype,
                        size,
                        storage: 'cloudinary',
                    };
                }
            } catch (cldErr: any) {
                this.logger.warn(`Cloudinary upload failed: ${cldErr.message}. Falling back to local storage path.`);
            }
        }

        // 4. Fallback to local path when storage credentials unset or upload failed
        const safeName = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const localUrl = `/uploads/homework/${caller?.tenantId || 'global'}/${safeName}`;

        return {
            url: localUrl,
            publicId: `local_${safeName}`,
            filename,
            mimetype,
            size,
            storage: 'local_fallback',
        };
    }
}
