import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateGradeDto, UpdateGradeDto } from './dto/grade.dto';

@Injectable()
export class GradesService {
    private readonly logger = new Logger(GradesService.name);

    constructor(
        private readonly supabase: SupabaseService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only admins can manage grades');
        }
    }


    async create(dto: CreateGradeDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('grades')
            .insert({
                level: dto.level,
                name: dto.name,
                curriculum_type: dto.curriculumType ?? 'GENERAL',
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Grade with that level or name already exists');
            this.logger.error(`Failed to create grade: ${error.message}`);
            throw new InternalServerErrorException('Failed to create grade');
        }
        return data;
    }

    async findAll(caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('grades')
            .select('*')
            .order('level', { ascending: true });

        if (error) {
            this.logger.error(`Failed to list grades: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch grades');
        }
        return data ?? [];
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('grades')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch grade');
        if (!data) throw new NotFoundException(`Grade ${id} not found`);
        return data;
    }

    async update(id: string, dto: UpdateGradeDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const updates: any = {};
        if (dto.level !== undefined) updates.level = dto.level;
        if (dto.name !== undefined) updates.name = dto.name;
        if (dto.curriculumType !== undefined) updates.curriculum_type = dto.curriculumType;
        if (dto.isActive !== undefined) updates.is_active = dto.isActive;

        const { data, error } = await db
            .from('grades')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Grade limit/name conflict');
            throw new InternalServerErrorException('Failed to update grade');
        }
        if (!data) throw new NotFoundException(`Grade ${id} not found`);
        return data;
    }

    async delete(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { error, count } = await db
            .from('grades')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            // Handle restrict foreign key
            if (error.code === '23503') throw new ConflictException('Cannot delete grade, classes are currently assigned to it');
            throw new InternalServerErrorException('Failed to delete grade');
        }

        if (count === 0) {
            throw new NotFoundException(`Grade ${id} not found`);
        }
        return { success: true };
    }
}
