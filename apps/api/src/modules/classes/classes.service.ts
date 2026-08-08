// =============================================================================
// Classes Service
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
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantService } from '../tenant/tenant.service';
import { CreateClassDto, UpdateClassDto, AssignTeacherDto } from './dto/class.dto';

@Injectable()
export class ClassesService {
    private readonly logger = new Logger(ClassesService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage classes');
        }
    }

    private async resolveSlug(caller: JwtPayload): Promise<string> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        return tenant.slug;
    }

    async create(dto: CreateClassDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('classes')
            .insert({ grade: dto.grade, section: dto.section, year: dto.year, medium: dto.medium ?? null })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ConflictException(
                    `Class Grade ${dto.grade}-${dto.section} for year ${dto.year} already exists`,
                );
            }
            this.logger.error(`Failed to create class: ${error.message}`);
            throw new InternalServerErrorException('Failed to create class');
        }
        return data;
    }

    async findAll(caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('classes')
            .select('*, class_teachers(*, teachers(*, users(*)))')
            .order('grade', { ascending: true })
            .order('section', { ascending: true });

        if (error) {
            this.logger.error(`Failed to list classes: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch classes');
        }
        return data ?? [];
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('classes')
            .select('*, class_teachers(*, teachers(*, users(*))), students(id, admission_no, users(full_name))')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch class');
        if (!data) throw new NotFoundException(`Class ${id} not found`);
        return data;
    }

    async update(id: string, dto: UpdateClassDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('classes')
            .update(dto)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Class with that grade/section/year already exists');
            throw new InternalServerErrorException('Failed to update class');
        }
        if (!data) throw new NotFoundException(`Class ${id} not found`);
        return data;
    }

    async remove(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db.from('classes').delete().eq('id', id);
        if (error) throw new InternalServerErrorException('Failed to delete class');
        return { message: 'Class deleted successfully' };
    }

    async assignTeacher(classId: string, dto: AssignTeacherDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('class_teachers')
            .insert({
                class_id: classId,
                teacher_id: dto.teacherId,
                is_homeroom: dto.isHomeroom ?? false,
                subject: dto.subject ?? null,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Teacher is already assigned to this class');
            if (error.code === '23503') throw new NotFoundException('Class or teacher not found');
            this.logger.error(`Failed to assign teacher: ${error.message}`);
            throw new InternalServerErrorException('Failed to assign teacher');
        }
        return data;
    }

    async removeTeacher(classId: string, teacherId: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db
            .from('class_teachers')
            .delete()
            .eq('class_id', classId)
            .eq('teacher_id', teacherId);

        if (error) throw new InternalServerErrorException('Failed to remove teacher from class');
        return { message: 'Teacher removed from class' };
    }
}
