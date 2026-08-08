// =============================================================================
// Students Service
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
import { CreateStudentDto, UpdateStudentDto, AssignClassDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
    private readonly logger = new Logger(StudentsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly tenantService: TenantService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage students');
        }
    }

    private async resolveSlug(caller: JwtPayload): Promise<string> {
        const tenant = await this.tenantService.findOneById(caller.tenantId, caller);
        return tenant.slug;
    }

    private generateAdmissionNo(year: number, seq: number): string {
        return `${year}/${String(seq).padStart(4, '0')}`;
    }

    async enroll(dto: CreateStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        // Step 1: Generate admission number if not provided
        const admissionNo = dto.admissionNo ?? this.generateAdmissionNo(
            new Date().getFullYear(),
            Math.floor(Math.random() * 9000) + 1000,
        );

        // Map admissionNo to a dummy email for Supabase Auth since students log in via admissionNo
        const normalizedAdmission = admissionNo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const fakeEmail = `${normalizedAdmission}@${slug}.student.local`;

        // Step 2: Create Supabase Auth user
        const { data: authData, error: authErr } = await this.supabase.adminClient.auth.admin.createUser({
            email: fakeEmail,
            password: dto.temporaryPassword,
            email_confirm: true,
        });

        if (authErr || !authData.user) {
            this.logger.error(`Supabase auth createUser failed: ${authErr?.message}`);
            if (authErr?.message.includes('email address')) {
                throw new ConflictException('A student with this admission number already has an account');
            }
            throw new InternalServerErrorException('Failed to create authentication account');
        }

        const authUid = authData.user.id;

        try {
            // Step 2: Insert into tenant users table
            const { data: userRow, error: userErr } = await db
                .from('users')
                .insert({
                    auth_uid: authUid,
                    email: dto.email ?? null,
                    full_name: dto.fullName,
                    role: UserRole.STUDENT,
                    phone_number: dto.phoneNumber ?? null,
                })
                .select()
                .single();

            if (userErr || !userRow) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                throw new InternalServerErrorException('Failed to create user profile');
            }

            // Step 4: Insert into students table
            const { data: studentRow, error: studentErr } = await db
                .from('students')
                .insert({
                    user_id: userRow.id,
                    class_id: dto.classId ?? null,
                    admission_no: admissionNo,
                    date_of_birth: dto.dateOfBirth ?? null,
                    gender: dto.gender ?? null,
                    al_stream: dto.alStream ?? null,
                    medium: dto.medium ?? null,
                })
                .select('*, users(full_name, email, phone_number)')
                .single();

            if (studentErr) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                if (studentErr.code === '23505') throw new ConflictException('Admission number already exists');
                if (studentErr.message?.toLowerCase().includes('cap exceeded')) {
                    throw new ForbiddenException(studentErr.message);
                }
                throw new InternalServerErrorException('Failed to enroll student');
            }

            this.logger.log(`Enrolled student ${admissionNo} for tenant ${slug}`);
            return studentRow;
        } catch (err) {
            // Rollback auth user on unexpected errors
            if (err instanceof InternalServerErrorException || err instanceof ConflictException) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid).catch(() => null);
            }
            throw err;
        }
    }

    async findMe(caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data: user } = await db.from('users').select('id').eq('user_id', caller.sub).maybeSingle();
        if (!user) throw new NotFoundException('User profile not found');

        const { data: student } = await db.from('students').select('*').eq('user_id', user.id).maybeSingle();
        if (!student) throw new NotFoundException('Student profile not found');

        return student;
    }

    async findAll(caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('students')
            .select('*, users(full_name, email, phone_number, avatar_url), classes(grade, section, year)')
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to fetch students');
        return data ?? [];
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('students')
            .select('*, users(full_name, email, phone_number, avatar_url, role, is_active), classes(grade, section, year), parent_children(parent_user_id, relationship, users(full_name, email))')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch student');
        if (!data) throw new NotFoundException(`Student ${id} not found`);
        return data;
    }

    async updateProfile(id: string, dto: UpdateStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        // Fetch student to get user_id
        const { data: studentRow } = await db
            .from('students')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (!studentRow) throw new NotFoundException(`Student ${id} not found`);

        // Update user profile fields
        if (dto.fullName || dto.phoneNumber) {
            await db.from('users')
                .update({
                    ...(dto.fullName && { full_name: dto.fullName }),
                    ...(dto.phoneNumber && { phone_number: dto.phoneNumber }),
                })
                .eq('id', studentRow.user_id);
        }

        // Update student-specific fields
        const { data, error } = await db
            .from('students')
            .update({
                ...(dto.dateOfBirth && { date_of_birth: dto.dateOfBirth }),
                ...(dto.gender && { gender: dto.gender }),
                ...(dto.alStream && { al_stream: dto.alStream }),
            })
            .eq('id', id)
            .select('*, users(full_name, email)')
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to update student');
        if (!data) throw new NotFoundException(`Student ${id} not found`);
        return data;
    }

    async assignToClass(id: string, dto: AssignClassDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('students')
            .update({ class_id: dto.classId })
            .eq('id', id)
            .select('*, classes(grade, section, year), users(full_name)')
            .maybeSingle();

        if (error) {
            if (error.code === '23503') throw new NotFoundException('Class not found');
            throw new InternalServerErrorException('Failed to assign class');
        }
        if (!data) throw new NotFoundException(`Student ${id} not found`);
        return data;
    }

    async deactivate(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = await this.resolveSlug(caller);
        const db = this.supabase.getTenantClient(slug);

        const { data: studentRow } = await db.from('students').select('user_id').eq('id', id).maybeSingle();
        if (!studentRow) throw new NotFoundException(`Student ${id} not found`);

        const { error } = await db.from('users').update({ is_active: false }).eq('id', studentRow.user_id);
        if (error) throw new InternalServerErrorException('Failed to deactivate student');
        return { message: 'Student deactivated' };
    }
}
