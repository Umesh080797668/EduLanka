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
import { CreateStudentDto, UpdateStudentDto, AssignClassDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
    private readonly logger = new Logger(StudentsService.name);

    constructor(
        private readonly supabase: SupabaseService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage students');
        }
    }


    private generateAdmissionNo(year: number, seq: number): string {
        return `${year}/${String(seq).padStart(4, '0')}`;
    }

    async enroll(dto: CreateStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        // Step 1: Generate admission number if not provided
        const admissionNo = (dto.admissionNo && dto.admissionNo.trim() !== '') ? dto.admissionNo : this.generateAdmissionNo(
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
                    user_id: authUid,
                    email: fakeEmail,
                    full_name: dto.fullName,
                    role: UserRole.STUDENT, tenant_id: slug,
                    phone_number: dto.phoneNumber ?? null,
                })
                .select()
                .single();

            if (userErr || !userRow) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                this.logger.error('Users Insert Failed: ' + userErr?.message); throw new InternalServerErrorException('Failed to create user profile: ' + userErr?.message);
            }

            // Step 4: Insert into students table
            const { data: studentRow, error: studentErr } = await db
                .from('students')
                .insert({
                    user_id: userRow.id,
                    class_id: (dto.classId && dto.classId.trim() !== '') ? dto.classId : null,
                    admission_no: admissionNo,
                    date_of_birth: dto.dateOfBirth ?? null,
                    gender: dto.gender ?? null,
                    al_stream: dto.alStream ?? null,
                    tenant_id: slug,
                })
                .select('*')
                .single();

            if (studentErr) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                if (studentErr.code === '23505') throw new ConflictException('Admission number already exists');
                if (studentErr.message?.toLowerCase().includes('cap exceeded')) {
                    throw new ForbiddenException(studentErr.message);
                }
                this.logger.error(`Failed to enroll student: ${studentErr.message}`);
                throw new InternalServerErrorException('Failed to enroll student: ' + studentErr.message);
            }

            this.logger.log(`Enrolled student ${admissionNo} for tenant ${slug}`);
            studentRow.users = { full_name: userRow.full_name, email: userRow.email, phone_number: userRow.phone_number };
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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: student } = await db.from('students').select('*').eq('user_id', caller.sub).maybeSingle();
        if (!student) throw new NotFoundException('Student profile not found');

        return student;
    }

    async findAll(caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('students')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to fetch students');

        const { data: classData } = await db.from('classes').select('*');
        const classMap = new Map();
        if (classData) classData.forEach((c: any) => classMap.set(c.id, c));

        const { data: usersData } = await db.from('users').select('*');
        const userMap = new Map();
        if (usersData) usersData.forEach((u: any) => userMap.set(u.id, u));

        let students = data ?? [];
        students.forEach((s: any) => {
            s.classes = classMap.get(s.class_id);
            s.users = userMap.get(s.user_id);
        });

        return students;
    }

    async findOne(id: string, caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('students')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            if (error.code === '22P02') throw new NotFoundException(`Invalid student ID format: ${id}`);
            throw new InternalServerErrorException('Failed to fetch student');
        }
        if (!data) throw new NotFoundException(`Student ${id} not found`);

        const { data: userData } = await db.from('users').select('full_name, email, phone_number, avatar_url, role, is_active').eq('id', data.user_id).maybeSingle();
        data.users = userData;

        const { data: classData } = await db.from('classes').select('*').eq('id', data.class_id).maybeSingle();
        data.classes = classData;
        const { data: parentData } = await db.from('parent_children').select('*').eq('student_id', id);
        data.parent_children = parentData || [];
        return data;
    }

    async updateProfile(id: string, dto: UpdateStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
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
            .select('*')
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to update student');
        if (!data) throw new NotFoundException(`Student ${id} not found`);
        return data;
    }

    async assignToClass(id: string, dto: AssignClassDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('students')
            .update({ class_id: dto.classId })
            .eq('id', id)
            .select('*')
            .maybeSingle();

        if (error) {
            if (error.code === '22P02') throw new NotFoundException(`Invalid student or class ID format`);
            if (error.code === '23503') throw new NotFoundException('Class not found');
            throw new InternalServerErrorException('Failed to assign class');
        }
        if (!data) throw new NotFoundException(`Student ${id} not found`);
        return data;
    }

    async deactivate(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: studentRow } = await db.from('students').select('user_id').eq('id', id).maybeSingle();
        if (!studentRow) throw new NotFoundException(`Student ${id} not found`);

        const { error } = await db.from('users').update({ is_active: false }).eq('id', studentRow.user_id);
        if (error) throw new InternalServerErrorException('Failed to deactivate student');
        return { message: 'Student deactivated' };
    }
}
