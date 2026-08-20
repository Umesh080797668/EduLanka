import {
    Injectable,
    InternalServerErrorException,
    Logger,
    ForbiddenException,
    NotFoundException
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
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

        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        if (caller.role === UserRole.TEACHER) {
            const { data: teacher } = await db.from('teachers').select('id').eq('user_id', caller.sub).maybeSingle();
            if (!teacher) throw new NotFoundException('Teacher profile not found');
        }

        let letterGrade = 'W';
        if (dto.marks >= 75) letterGrade = 'A';
        else if (dto.marks >= 65) letterGrade = 'B';
        else if (dto.marks >= 50) letterGrade = 'C';
        else if (dto.marks >= 35) letterGrade = 'S';

        const { data, error } = await db
            .from('student_marks')
            .upsert({
                tenant_id: slug,
                student_id: dto.studentId,
                class_id: dto.classId,
                subject: dto.subject,
                term: String(dto.term),
                marks: dto.marks,
                total_score: dto.marks,
                grade: letterGrade
            }, { onConflict: 'tenant_id, student_id, term, subject' })
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to record marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to record marks');
        }
        return data;
    }

    async getMarksByClass(classId: string, term: number, caller: JwtPayload) {
        if (caller.role === UserRole.STUDENT || caller.role === UserRole.PARENT) {
            throw new ForbiddenException('Not allowed to view full class marks');
        }

        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('student_marks')
            .select('*, students(admission_no)')
            .eq('class_id', classId)
            .eq('term', String(term));

        if (error) {
            this.logger.error(`Failed to fetch marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch marks');
        }
        return data ?? [];
    }

    async getMarksByStudent(studentId: string, caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

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
}
