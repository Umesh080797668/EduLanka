// =============================================================================
// Parents Service
// =============================================================================
import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole, ParentRelationship } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from '../tenant/tenant.service';
import { LinkStudentDto } from './dto/parent.dto';

@Injectable()
export class ParentsService {
    private readonly logger = new Logger(ParentsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage parent-student links');
        }
    }

    private async resolveSlug(caller: JwtPayload): Promise<string> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        return tenant.slug;
    }

    async getMe(caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('users')
            .select('*, parent_children(id, student_id, relationship, students(id, admission_no, classes(grade, section, year), users(full_name, email)))')
            .eq('user_id', caller.sub)
            .eq('role', UserRole.PARENT)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch parent profile');
        if (!data) throw new NotFoundException('Parent profile not found');

        return {
            users: { full_name: data.full_name, email: data.email },
            children: (data.parent_children || []).map((pc: any) => ({
                id: pc.student_id,
                name: pc.students?.users?.full_name,
                grade: pc.students?.classes ? `${pc.students.classes.grade} ${pc.students.classes.section}` : 'N/A',
                gpa: null,
                attendance: null
            }))
        };
    }

    async findAll(caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('users')
            .select('*, parent_children(student_id, relationship, students(id, admission_no, users(full_name)))')
            .eq('role', UserRole.PARENT)
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to fetch parents');
        return data ?? [];
    }

    async findOne(parentUserId: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('users')
            .select('*, parent_children(id, student_id, relationship, students(id, admission_no, users(full_name, email)))')
            .eq('id', parentUserId)
            .eq('role', UserRole.PARENT)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch parent');
        if (!data) throw new NotFoundException(`Parent ${parentUserId} not found`);
        return data;
    }

    async getChildren(parentUserId: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('parent_children')
            .select('*, students(id, admission_no, al_stream, users(full_name, email), classes(grade, section, year))')
            .eq('parent_user_id', parentUserId);

        if (error) throw new InternalServerErrorException('Failed to fetch children');
        return data ?? [];
    }

    async linkToStudent(parentUserId: string, dto: LinkStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        // Verify parent user exists and has PARENT role
        const { data: parentUser } = await db
            .from('users')
            .select('id, role')
            .eq('id', parentUserId)
            .eq('role', UserRole.PARENT)
            .maybeSingle();

        if (!parentUser) throw new NotFoundException(`Parent user ${parentUserId} not found`);

        const { data, error } = await db
            .from('parent_children')
            .insert({
                parent_user_id: parentUserId,
                student_id: dto.studentId,
                relationship: dto.relationship ?? ParentRelationship.GUARDIAN,
            })
            .select('*, students(id, admission_no, users(full_name))')
            .single();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Parent is already linked to this student');
            if (error.code === '23503') throw new NotFoundException('Student not found');
            this.logger.error(`Failed to link parent: ${error.message}`);
            throw new InternalServerErrorException('Failed to link parent to student');
        }

        this.logger.log(`Linked parent ${parentUserId} to student ${dto.studentId}`);
        return data;
    }

    async unlinkFromStudent(parentUserId: string, studentId: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db
            .from('parent_children')
            .delete()
            .eq('parent_user_id', parentUserId)
            .eq('student_id', studentId);

        if (error) throw new InternalServerErrorException('Failed to unlink parent from student');
        return { message: 'Parent unlinked from student' };
    }
}
