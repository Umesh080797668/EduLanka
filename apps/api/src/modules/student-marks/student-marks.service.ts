import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    InternalServerErrorException,
    Logger,
    ForbiddenException,
    NotFoundException
} from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service';

import { CreateMarkDto } from './dto/student-marks.dto';

@Injectable()
export class StudentMarksService {
    private readonly logger = new Logger(StudentMarksService.name);

    constructor(
        private readonly supabase: SupabaseService,
    ) { }


    async upsertMark(dto: CreateMarkDto, caller: JwtPayload) {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.TEACHER && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and admins can enter marks');
        }

        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);
        const academicYear = dto.academicYear || new Date().getFullYear();

        // 1. Authorization: Verify teacher is assigned to the class
        if (caller.role === UserRole.TEACHER) {
            const { data: teacher } = await db.from('teachers').select('id').eq('user_id', caller.sub).maybeSingle();
            if (!teacher) throw new NotFoundException('Teacher profile not found');

            const { data: assignment } = await db
                .from('class_teachers')
                .select('id')
                .eq('teacher_id', teacher.id)
                .eq('class_id', dto.classId)
                .maybeSingle();

            if (!assignment) {
                throw new ForbiddenException('You are not assigned to teach this class');
            }
        }

        // 2. Validation: Verify student belongs to the target class
        const { data: student } = await db
            .from('students')
            .select('id, class_id')
            .eq('id', dto.studentId)
            .maybeSingle();

        if (!student) {
            throw new NotFoundException('Student not found');
        }
        if (student.class_id !== dto.classId) {
            throw new ForbiddenException('Student does not belong to the specified class');
        }

        // 3. Finalization Guard: Reject mark edits once term is finalized
        const { data: finalization } = await db
            .from('term_finalizations')
            .select('id, is_finalized')
            .eq('tenant_id', tenantId)
            .eq('class_id', dto.classId)
            .eq('academic_year', academicYear)
            .eq('term', dto.term)
            .maybeSingle();

        if (finalization?.is_finalized) {
            throw new ForbiddenException('Term marks have been finalized and locked. Contact an administrator to reopen.');
        }

        let letterGrade = 'W';
        if (dto.marks >= 75) letterGrade = 'A';
        else if (dto.marks >= 65) letterGrade = 'B';
        else if (dto.marks >= 50) letterGrade = 'C';
        else if (dto.marks >= 35) letterGrade = 'S';

        const { data, error } = await db
            .from('student_marks')
            .upsert({
                tenant_id: tenantId,
                student_id: dto.studentId,
                class_id: dto.classId,
                subject: dto.subject,
                term: String(dto.term),
                academic_year: academicYear,
                marks: dto.marks,
                total_score: dto.marks,
                grade: letterGrade
            }, { onConflict: 'tenant_id, student_id, academic_year, term, subject' })
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to record marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to record marks');
        }
        return data;
    }

    async getMarksByClass(classId: string, term: number, year: number, caller: JwtPayload) {
        if (caller.role === UserRole.STUDENT || caller.role === UserRole.PARENT) {
            throw new ForbiddenException('Not allowed to view full class marks');
        }

        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);
        const academicYear = year || new Date().getFullYear();

        if (caller.role === UserRole.TEACHER) {
            const { data: teacher } = await db.from('teachers').select('id').eq('user_id', caller.sub).maybeSingle();
            if (!teacher) throw new NotFoundException('Teacher profile not found');

            const { data: assignment } = await db
                .from('class_teachers')
                .select('id')
                .eq('teacher_id', teacher.id)
                .eq('class_id', classId)
                .maybeSingle();

            if (!assignment) {
                throw new ForbiddenException('You are not assigned to view marks for this class');
            }
        }

        const { data, error } = await db
            .from('student_marks')
            .select('*, students(admission_no)')
            .eq('class_id', classId)
            .eq('term', String(term))
            .eq('academic_year', academicYear);

        if (error) {
            this.logger.error(`Failed to fetch marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch marks');
        }
        return data ?? [];
    }

    async getMarksByStudent(studentId: string, caller: JwtPayload) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        if (caller.role === UserRole.STUDENT) {
            const { data: stu } = await db.from('students').select('user_id').eq('id', studentId).maybeSingle();
            if (stu?.user_id !== caller.sub) {
                throw new ForbiddenException('Not allowed');
            }
        } else if (caller.role === UserRole.PARENT) {
            const { data: pc } = await db.from('parents').select('id').eq('user_id', caller.sub).eq('student_id', studentId).maybeSingle();
            if (!pc) {
                throw new ForbiddenException('Parent is not linked to this student');
            }
        }

        const { data, error } = await db
            .from('student_marks')
            .select('*')
            .eq('student_id', studentId)
            .order('term', { ascending: false });

        if (error) {
            this.logger.error(`Failed to fetch student marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch marks');
        }
        return data ?? [];
    }

    async getFinalizationStatus(classId: string, term: number, year: number, caller: JwtPayload) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);
        const academicYear = year || new Date().getFullYear();

        const { data, error } = await db
            .from('term_finalizations')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('class_id', classId)
            .eq('academic_year', academicYear)
            .eq('term', term)
            .maybeSingle();

        if (error) {
            this.logger.error(`Failed to fetch finalization status: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch term finalization status');
        }

        return {
            isFinalized: Boolean(data?.is_finalized),
            finalization: data || null,
        };
    }

    async finalizeTerm(classId: string, term: number, year: number, caller: JwtPayload) {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.TEACHER && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and school admins can finalize terms');
        }

        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);
        const academicYear = year || new Date().getFullYear();

        if (caller.role === UserRole.TEACHER) {
            const { data: teacher } = await db.from('teachers').select('id').eq('user_id', caller.sub).maybeSingle();
            if (!teacher) throw new NotFoundException('Teacher profile not found');

            const { data: assignment } = await db
                .from('class_teachers')
                .select('id')
                .eq('teacher_id', teacher.id)
                .eq('class_id', classId)
                .maybeSingle();

            if (!assignment) {
                throw new ForbiddenException('You are not assigned to finalize terms for this class');
            }
        }

        const now = new Date().toISOString();
        const { data, error } = await db
            .from('term_finalizations')
            .upsert({
                tenant_id: tenantId,
                class_id: classId,
                academic_year: academicYear,
                term,
                is_finalized: true,
                finalized_at: now,
                finalized_by: caller.sub,
                updated_at: now,
            }, { onConflict: 'tenant_id, class_id, academic_year, term' })
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to persist term finalization: ${error.message}`);
            throw new InternalServerErrorException('Failed to finalize term marks');
        }

        return {
            success: true,
            message: `Term ${term} marks finalized successfully for class ${classId}`,
            classId,
            term,
            academicYear,
            finalizedAt: data.finalized_at,
            finalizedBy: caller.sub,
        };
    }

    async reopenTerm(classId: string, term: number, year: number, caller: JwtPayload) {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school administrators can reopen finalized terms');
        }

        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);
        const academicYear = year || new Date().getFullYear();
        const now = new Date().toISOString();

        const { error } = await db
            .from('term_finalizations')
            .update({
                is_finalized: false,
                reopened_at: now,
                reopened_by: caller.sub,
                updated_at: now,
            })
            .eq('tenant_id', tenantId)
            .eq('class_id', classId)
            .eq('academic_year', academicYear)
            .eq('term', term)
            .select()
            .maybeSingle();

        if (error) {
            this.logger.error(`Failed to reopen term: ${error.message}`);
            throw new InternalServerErrorException('Failed to reopen term marks');
        }

        return {
            success: true,
            message: `Term ${term} marks reopened successfully for class ${classId}`,
            classId,
            term,
            academicYear,
            reopenedAt: now,
            reopenedBy: caller.sub,
        };
    }
}
