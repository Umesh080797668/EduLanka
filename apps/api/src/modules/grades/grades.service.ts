import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    Logger,
    ForbiddenException,
} from '@nestjs/common';

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
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data, error } = await db
            .from('grades_config')
            .insert({
                tenant_id: tenantId,
                level: dto.level,
                label: dto.name || `Grade ${dto.level}`,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Grade with that level already exists');
            this.logger.error(`Failed to create grade: ${error.message}`);
            throw new InternalServerErrorException('Failed to create grade');
        }
        return { ...data, name: data.label };
    }

    async findAll(caller: JwtPayload) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data, error } = await db
            .from('grades_config')
            .select('*')
            .order('level', { ascending: true });

        if (error) {
            this.logger.error(`Failed to list grades: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch grades');
        }
        return (data ?? []).map((g: any) => ({ ...g, name: g.label }));
    }

    async findOne(id: string, caller: JwtPayload) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data, error } = await db
            .from('grades_config')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch grade');
        if (!data) throw new NotFoundException(`Grade ${id} not found`);
        return { ...data, name: data.label };
    }

    async update(id: string, dto: UpdateGradeDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const updates: any = {};
        if (dto.level !== undefined) updates.level = dto.level;
        if (dto.name !== undefined) updates.label = dto.name;

        const { data, error } = await db
            .from('grades_config')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            if (error.code === '23505') throw new ConflictException('Grade level conflict');
            throw new InternalServerErrorException('Failed to update grade');
        }
        if (!data) throw new NotFoundException(`Grade ${id} not found`);
        return { ...data, name: data.label };
    }

    async delete(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { error, count } = await db
            .from('grades_config')
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
