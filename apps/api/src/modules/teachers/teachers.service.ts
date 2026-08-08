// =============================================================================
// Teachers Service
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
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

@Injectable()
export class TeachersService {
    private readonly logger = new Logger(TeachersService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage teachers');
        }
    }

    private async resolveSlug(caller: JwtPayload): Promise<string> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        return tenant.slug;
    }

    private generateEmployeeNo(year: number, seq: number): string {
        return `EMP/${year}/${String(seq).padStart(4, '0')}`;
    }

    async create(dto: CreateTeacherDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        // Step 1: Create Supabase auth user
        const { data: authData, error: authErr } = await this.supabase.adminClient.auth.admin.createUser({
            email: dto.email,
            password: dto.temporaryPassword,
            email_confirm: true,
        });

        if (authErr || !authData.user) {
            this.logger.error(`Supabase auth createUser failed: ${authErr?.message}`);
            throw new InternalServerErrorException('Failed to create authentication account');
        }

        const authUid = authData.user.id;

        try {
            // Step 2: Insert tenant user
            const { data: userRow, error: userErr } = await db
                .from('users')
                .insert({
                    auth_uid: authUid,
                    email: dto.email,
                    full_name: dto.fullName,
                    role: UserRole.TEACHER,
                    phone_number: dto.phoneNumber ?? null,
                })
                .select()
                .single();

            if (userErr || !userRow) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                throw new InternalServerErrorException('Failed to create user profile');
            }

            // Step 3: Generate employee number if not provided
            const employeeNo = dto.employeeNo ?? this.generateEmployeeNo(
                new Date().getFullYear(),
                Math.floor(Math.random() * 9000) + 1000,
            );

            // Step 4: Insert teacher profile
            const { data: teacherRow, error: teacherErr } = await db
                .from('teachers')
                .insert({
                    user_id: userRow.id,
                    employee_no: employeeNo,
                    subject_areas: dto.subjectAreas ?? [],
                    hire_date: dto.hireDate ?? null,
                })
                .select('*, users(full_name, email, phone_number)')
                .single();

            if (teacherErr) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                if (teacherErr.code === '23505') throw new ConflictException('Employee number already exists');
                throw new InternalServerErrorException('Failed to create teacher profile');
            }

            this.logger.log(`Created teacher ${employeeNo} for tenant ${slug}`);
            return teacherRow;
        } catch (err) {
            if (err instanceof InternalServerErrorException || err instanceof ConflictException) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid).catch(() => null);
            }
            throw err;
        }
    }

    async findAll(caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('teachers')
            .select('*, users(full_name, email, phone_number, avatar_url)')
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to fetch teachers');
        return data ?? [];
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('teachers')
            .select('*, users(full_name, email, phone_number, avatar_url, is_active), class_teachers(*, classes(grade, section, year))')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch teacher');
        if (!data) throw new NotFoundException(`Teacher ${id} not found`);
        return data;
    }

    async update(id: string, dto: UpdateTeacherDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data: teacherRow } = await db
            .from('teachers')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (!teacherRow) throw new NotFoundException(`Teacher ${id} not found`);

        if (dto.fullName || dto.phoneNumber) {
            await db.from('users')
                .update({
                    ...(dto.fullName && { full_name: dto.fullName }),
                    ...(dto.phoneNumber && { phone_number: dto.phoneNumber }),
                })
                .eq('id', teacherRow.user_id);
        }

        const { data, error } = await db
            .from('teachers')
            .update({
                ...(dto.subjectAreas && { subject_areas: dto.subjectAreas }),
                ...(dto.hireDate && { hire_date: dto.hireDate }),
            })
            .eq('id', id)
            .select('*, users(full_name, email)')
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to update teacher');
        if (!data) throw new NotFoundException(`Teacher ${id} not found`);
        return data;
    }

    async getClasses(id: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('class_teachers')
            .select('*, classes(id, grade, section, year)')
            .eq('teacher_id', id);

        if (error) throw new InternalServerErrorException('Failed to fetch teacher classes');
        return data ?? [];
    }
}
