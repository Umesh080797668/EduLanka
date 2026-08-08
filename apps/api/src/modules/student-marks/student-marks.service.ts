import {
    Injectable,
    InternalServerErrorException,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from '../tenant/tenant.service';
import { CreateMarkDto } from './dto/student-marks.dto';

@Injectable()
export class StudentMarksService {
    private readonly logger = new Logger(StudentMarksService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
    ) { }

    private async resolveSlug(caller: JwtPayload): Promise<string> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        return tenant.slug;
    }

    async upsertMark(dto: CreateMarkDto, caller: JwtPayload) {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.TEACHER && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only teachers and admins can enter marks');
        }

        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        let teacherId = null;
        if (caller.role === UserRole.TEACHER) {
            const { data: user } = await db.from('users').select('id').eq('user_id', caller.sub).maybeSingle();
            if (user) {
                const { data: teacher } = await db.from('teachers').select('id').eq('user_id', user.id).maybeSingle();
                if (teacher) {
                    teacherId = teacher.id;
                }
            }
        }

        const { data, error } = await db
            .from('student_marks')
            .upsert({
                student_id: dto.studentId,
                class_id: dto.classId,
                subject: dto.subject,
                term: dto.term,
                academic_year: dto.academicYear,
                marks: dto.marks,
                teacher_id: teacherId
            }, { onConflict: 'student_id, subject, term, academic_year' })
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

        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('student_marks')
            .select('*, students(admission_no)')
            .eq('class_id', classId)
            .eq('term', term)
            .eq('academic_year', year);

        if (error) {
            this.logger.error(`Failed to fetch marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch marks');
        }
        return data ?? [];
    }

    async getMarksByStudent(studentId: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        if (caller.role === UserRole.STUDENT) {
            const { data: stu } = await db.from('students').select('users!inner(user_id)').eq('id', studentId).maybeSingle();
            const userRef = (stu as any)?.users;
            const actualSub = Array.isArray(userRef) ? userRef[0]?.user_id : userRef?.user_id;

            if (actualSub !== caller.sub) {
                throw new ForbiddenException('Not allowed');
            }
        } else if (caller.role === UserRole.PARENT) {
            const { data: pa } = await db.from('users').select('id').eq('user_id', caller.sub).maybeSingle();
            const { data: pc } = await db.from('parent_children').select('id').eq('parent_user_id', pa?.id).eq('student_id', studentId).maybeSingle();
            if (!pc) {
                throw new ForbiddenException('Not allowed');
            }
        }

        const { data, error } = await db
            .from('student_marks')
            .select('*')
            .eq('student_id', studentId)
            .order('academic_year', { ascending: false })
            .order('term', { ascending: false });

        if (error) {
            this.logger.error(`Failed to fetch student marks: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch marks');
        }
        return data ?? [];
    }
}
