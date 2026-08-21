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
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

@Injectable()
export class TeachersService {
    private readonly logger = new Logger(TeachersService.name);

    constructor(
        private readonly supabase: SupabaseService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage teachers');
        }
    }


    private generateEmployeeNo(year: number, seq: number): string {
        return `EMP/${year}/${String(seq).padStart(4, '0')}`;
    }

    async create(dto: CreateTeacherDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
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
                    user_id: authUid,
                    email: dto.email,
                    full_name: dto.fullName,
                    role: UserRole.TEACHER, tenant_id: slug,
                    phone_number: dto.phoneNumber ?? null,
                    avatar_url: dto.avatarUrl ?? null,
                })
                .select()
                .single();

            if (userErr || !userRow) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                this.logger.error('Users Insert Failed: ' + userErr?.message); throw new InternalServerErrorException('Failed to create user profile');
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
                    hire_date: dto.hireDate ?? null, tenant_id: slug,
                })
                .select('*')
                .single();

            if (teacherErr) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                if (teacherErr.code === '23505') throw new ConflictException('Employee number already exists');
                this.logger.error(`Failed to create teacher profile: ${teacherErr.message}`);
                throw new InternalServerErrorException('Failed to create teacher profile');
            }

            this.logger.log(`Created teacher ${employeeNo} for tenant ${slug}`);
            teacherRow.users = { full_name: userRow.full_name, email: userRow.email, phone_number: userRow.phone_number };
            return teacherRow;
        } catch (err) {
            if (err instanceof InternalServerErrorException || err instanceof ConflictException) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid).catch(() => null);
            }
            throw err;
        }
    }

    async findAll(caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('teachers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to fetch teachers');
        const { data: usersData } = await db.from('users').select('*');
        const userMap = new Map();
        if (usersData) usersData.forEach((u: any) => userMap.set(u.id, u));

        const teachers = data ?? [];
        teachers.forEach((t: any) => t.users = userMap.get(t.user_id));
        return teachers;
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('teachers')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch teacher');
        if (!data) throw new NotFoundException(`Teacher ${id} not found`);

        const { data: userData } = await db.from('users').select('*').eq('id', data.user_id).maybeSingle();
        data.users = userData;

        const { data: ctData } = await db.from('class_teachers').select('*, classes(grade, section, year)').eq('teacher_id', id);
        data.class_teachers = ctData || [];
        return data;
    }

    async update(id: string, dto: UpdateTeacherDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: teacherRow } = await db
            .from('teachers')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (!teacherRow) throw new NotFoundException(`Teacher ${id} not found`);

        if (dto.fullName || dto.phoneNumber || dto.avatarUrl) {
            await db.from('users')
                .update({
                    ...(dto.fullName && { full_name: dto.fullName }),
                    ...(dto.phoneNumber && { phone_number: dto.phoneNumber }),
                    ...(dto.avatarUrl && { avatar_url: dto.avatarUrl }),
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
            .select('*')
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to update teacher');
        if (!data) throw new NotFoundException(`Teacher ${id} not found`);
        return data;
    }

    async getClasses(id: string, caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('class_teachers')
            .select('*')
            .eq('teacher_id', id);

        if (error) throw new InternalServerErrorException('Failed to fetch teacher classes');

        let classList = data ?? [];
        if (classList.length > 0) {
            const classIds = classList.map((ct: any) => ct.class_id);
            const { data: classData } = await db.from('classes').select('*').in('id', classIds);
            const classMap = new Map();
            if (classData) classData.forEach((c: any) => classMap.set(c.id, c));

            classList.forEach((ct: any) => {
                ct.classes = classMap.get(ct.class_id);
            });
        }

        return classList;
    }

    async deactivate(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: teacherRow } = await db.from('teachers').select('user_id').eq('id', id).maybeSingle();
        if (!teacherRow) throw new NotFoundException(`Teacher ${id} not found`);

        const { error } = await db.from('users').update({ is_active: false }).eq('id', teacherRow.user_id);
        if (error) throw new InternalServerErrorException('Failed to deactivate teacher');
        return { message: 'Teacher deactivated' };
    }
}
