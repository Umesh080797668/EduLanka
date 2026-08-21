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
import { ChatService } from '../chat/chat.service';
import { CreateClassDto, UpdateClassDto, AssignTeacherDto } from './dto/class.dto';

@Injectable()
export class ClassesService {
    private readonly logger = new Logger(ClassesService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly chat: ChatService,
    ) { }

    /**
     * Keep the class group chat roster in step with staffing changes. Never
     * fatal — chat is a companion to the class, not a precondition for it.
     */
    private async syncClassGroup(tenantId: string, classId: string): Promise<void> {
        try {
            await this.chat.syncClassParticipants(tenantId, classId);
        } catch (err: any) {
            this.logger.warn(`Class group sync skipped for ${classId}: ${err?.message}`);
        }
    }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage classes');
        }
    }


    async create(dto: CreateClassDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: gradeConfig } = await db.from('grades_config').select('level').eq('id', dto.gradeId).single();
        if (!gradeConfig) throw new NotFoundException('Grade configuration not found');

        const { data, error } = await db
            .from('classes')
            .insert({
                tenant_id: slug,
                grade: gradeConfig.level,
                section: dto.section,
                year: dto.year,
                medium: dto.medium ?? null
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new ConflictException(
                    `Class Grade ${dto.gradeId} - ${dto.section} for year ${dto.year} already exists`,
                );
            }
            this.logger.error(`Failed to create class: ${error.message}`);
            throw new InternalServerErrorException('Failed to create class');
        }

        // Auto-provision class chat conversation (Phase 2, Sprint 1)
        const { error: chatError } = await db.from('chat_conversations').insert({
            tenant_id: slug,
            type: 'CLASS',
            class_id: data.id,
            name: `Grade ${gradeConfig.level}-${dto.section}`
        });

        if (chatError) {
            this.logger.error(`Failed to auto-provision chat conversation for class ${data.id}: ${chatError.message}`);
            // Non-blocking error, class created successfully
        } else {
            // A brand-new class has no roll yet, but it may already have staff.
            await this.syncClassGroup(slug, data.id);
        }

        return data;
    }

    async findAll(caller: JwtPayload, teacherId?: string) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: classesData, error: classesError } = await db
            .from('classes')
            .select('*, students(id), class_teachers(id, is_homeroom, subject, teacher_id, teachers(id, user_id, users(full_name, email)))')
            .order('section', { ascending: true });

        if (classesError) {
            this.logger.error(`Failed to list classes: ${classesError.message}`);
            throw new InternalServerErrorException('Failed to fetch classes');
        }

        const { data: gradesData } = await db.from('grades_config').select('*');
        const gradesMap = new Map();
        if (gradesData) gradesData.forEach((g: any) => gradesMap.set(g.level, g));

        let classes = (classesData || []).map((c: any) => ({
            ...c,
            grades: gradesMap.get(c.grade)
        }));

        if (teacherId) {
            classes = classes.filter((c: any) =>
                c.class_teachers?.some((ct: any) => ct.teachers?.user_id === teacherId)
            );
        }
        return classes.sort((a: any, b: any) => {
            const levelA = a.grades?.level ?? 0;
            const levelB = b.grades?.level ?? 0;
            return levelA - levelB;
        });
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('classes')
            .select('*, class_teachers(id, is_homeroom, subject, teacher_id, teachers(id, user_id, users(full_name, email))), students(id, admission_no, users(full_name, email))')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            if (error.code === '22P02') throw new NotFoundException(`Invalid class ID format: ${id}`);
            throw new InternalServerErrorException('Failed to fetch class');
        }
        if (!data) throw new NotFoundException(`Class ${id} not found`);

        const { data: gradesData } = await db.from('grades_config').select('*');
        const gradesMap = new Map();
        if (gradesData) gradesData.forEach((g: any) => gradesMap.set(g.level, g));
        data.grades = gradesMap.get(data.grade);

        return data;
    }

    async update(id: string, dto: UpdateClassDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db.from('classes').delete().eq('id', id);
        if (error) throw new InternalServerErrorException('Failed to delete class');
        return { message: 'Class deleted successfully' };
    }

    async assignTeacher(classId: string, dto: AssignTeacherDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
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
        await this.syncClassGroup(slug, classId);
        return data;
    }

    async removeTeacher(classId: string, teacherId: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db
            .from('class_teachers')
            .delete()
            .eq('class_id', classId)
            .eq('teacher_id', teacherId);

        if (error) {
            this.logger.error(`Failed to remove teacher from class: ${error.message}`, error);
            throw new InternalServerErrorException('Failed to remove teacher from class');
        }
        await this.syncClassGroup(slug, classId);
        return { message: 'Teacher removed from class' };
    }
}
