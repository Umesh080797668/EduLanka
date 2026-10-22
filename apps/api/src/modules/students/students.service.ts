// =============================================================================
// Students Service
// =============================================================================
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { ChatService } from '../chat/chat.service';
import { SupabaseService } from '../supabase/supabase.service';

import { CreateStudentDto, UpdateStudentDto, AssignClassDto } from './dto/student.dto';

@Injectable()
export class StudentsService {
    private readonly logger = new Logger(StudentsService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly chat: ChatService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage students');
        }
    }

    private async assertClassCapacity(tenantId: string, classId: string): Promise<void> {
        const { data: policy } = await this.supabase.adminClient
            .from('school_policy')
            .select('max_students_per_class')
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!policy || policy.max_students_per_class === null || policy.max_students_per_class === undefined) {
            // If unset or unconfigured by school policy, do not enforce an arbitrary limit
            return;
        }

        const limit = policy.max_students_per_class;
        const db = this.supabase.getTenantClient(tenantId);
        // Only count active enrolled students against class capacity
        const { count, error } = await db
            .from('students')
            .select('id, users!inner(is_active)', { count: 'exact', head: true })
            .eq('class_id', classId)
            .eq('users.is_active', true);

        if (error) {
            this.logger.error(`Failed to verify class capacity: ${error.message}`);
            return;
        }

        if ((count ?? 0) >= limit) {
            throw new BadRequestException(
                `Class has reached its maximum student capacity of ${limit} (school policy: maxStudentsPerClass).`,
            );
        }
    }

    private generateAdmissionNo(year: number, seq: number): string {
        return `${year}/${String(seq).padStart(4, '0')}`;
    }

    async enroll(dto: CreateStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;

        // Policy check: Enforce maxStudentsPerClass before creating accounts
        if (dto.classId && dto.classId.trim() !== '') {
            await this.assertClassCapacity(tenantId, dto.classId);
        }

        const db = this.supabase.getTenantClient(tenantId);

        // Step 1: Generate admission number if not provided (sequential & collision-safe)
        let admissionNo = dto.admissionNo?.trim();
        if (!admissionNo) {
            const currentYear = new Date().getFullYear();
            const { count } = await db
                .from('students')
                .select('id', { count: 'exact', head: true });
            let seq = (count ?? 0) + 1;
            admissionNo = this.generateAdmissionNo(currentYear, seq);

            let attempts = 0;
            while (attempts < 10) {
                const { data: existing } = await db
                    .from('students')
                    .select('id')
                    .eq('admission_no', admissionNo)
                    .maybeSingle();
                if (!existing) break;
                seq++;
                admissionNo = this.generateAdmissionNo(currentYear, seq);
                attempts++;
            }
        }

        let identityEmail = dto.email;
        const identityPhone = dto.phoneNumber;

        const authPayload: any = {
            password: dto.temporaryPassword,
        };

        if (identityEmail) {
            authPayload.email = identityEmail;
            authPayload.email_confirm = true;
        } else if (identityPhone) {
            authPayload.phone = identityPhone;
            authPayload.phone_confirm = true;
        } else {
            const normalizedAdmission = admissionNo.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            identityEmail = `stu_${normalizedAdmission}@${tenantId}.internal.edulanka.lk`;
            authPayload.email = identityEmail;
            authPayload.email_confirm = true;
        }

        // Step 2: Create Supabase Auth user
        const { data: authData, error: authErr } = await this.supabase.adminClient.auth.admin.createUser(authPayload);

        if (authErr || !authData.user) {
            this.logger.error(`Supabase auth createUser failed: ${authErr?.message}`);
            if (authErr?.message.includes('email address') || authErr?.message.includes('phone')) {
                throw new ConflictException('A user with this identity already exists');
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
                    email: identityEmail ?? null,
                    full_name: dto.fullName,
                    role: UserRole.STUDENT, tenant_id: tenantId,
                    phone_number: dto.phoneNumber ?? null,
                    avatar_url: dto.avatarUrl ?? null,
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
                    tenant_id: tenantId,
                })
                .select('*')
                .single();

            if (studentErr) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                if (studentErr.code === '23505') throw new ConflictException('Admission number already exists');
                // P0001: raised by enforce_student_cap() trigger when the 75-student Community cap is hit
                if (
                    studentErr.code === 'P0001' ||
                    studentErr.message?.toLowerCase().includes('community tier limit reached') ||
                    studentErr.message?.toLowerCase().includes('cap exceeded') ||
                    studentErr.message?.toLowerCase().includes('tier limit exceeded')
                ) {
                    throw new ConflictException(
                        'Community tier limit reached (75 active students max). Please upgrade to the Starter plan.',
                    );
                }
                this.logger.error(`Failed to enroll student: ${studentErr.message}`);
                throw new InternalServerErrorException('Failed to enroll student: ' + studentErr.message);
            }

            this.logger.log(`Enrolled student ${admissionNo} for tenant ${tenantId}`);
            if (studentRow.class_id) await this.syncClassGroup(tenantId, studentRow.class_id);
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
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data: student, error } = await db.from('students').select('*').eq('user_id', caller.sub).maybeSingle();
        if (error || !student) throw new NotFoundException('Student profile not found');

        const { data: userData } = await db.from('users').select('full_name, email, avatar_url').eq('id', student.user_id).maybeSingle();
        student.users = userData;

        if (student.class_id) {
            const { data: classData } = await db.from('classes').select('name, grade').eq('id', student.class_id).maybeSingle();
            student.classes = classData;
        }

        return student;
    }

    async findAll(caller: JwtPayload) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

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

        const students = data ?? [];
        students.forEach((s: any) => {
            s.classes = classMap.get(s.class_id);
            s.users = userMap.get(s.user_id);
        });

        return students;
    }

    async findOne(id: string, caller: JwtPayload) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

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
        const { data: parentData } = await db.from('parents').select('*').eq('student_id', id);
        data.parents = parentData || [];
        return data;
    }

    /**
     * Aggregates academic summary strictly scoped by academic_year and term
     * to eliminate cross-term mark bleed and reflect accurate letter grade distributions.
     */
    async getStudentSummary(
        id: string,
        caller: JwtPayload,
        academicYear?: number,
        term?: number,
    ) {
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);
        const year = academicYear || new Date().getFullYear();
        const currentTerm = term ?? 1;

        const { data: student, error: studentErr } = await db
            .from('students')
            .select('*, users!inner(full_name, email, is_active), classes(id, name, grade, section)')
            .eq('id', id)
            .maybeSingle();

        if (studentErr || !student) {
            throw new NotFoundException(`Student ${id} not found`);
        }

        if (caller.role === UserRole.STUDENT && student.user_id !== caller.sub) {
            throw new ForbiddenException('You can only view your own student summary');
        }

        // Query marks strictly scoped by academic_year and term (prevents cross-term bleed)
        const { data: marks, error: marksErr } = await db
            .from('student_marks')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('student_id', id)
            .eq('academic_year', year)
            .eq('term', String(currentTerm));

        if (marksErr) {
            this.logger.error(`Failed to fetch student marks for summary: ${marksErr.message}`);
            throw new InternalServerErrorException('Failed to calculate student summary');
        }

        const marksList = marks ?? [];
        const totalSubjects = marksList.length;
        let totalScore = 0;
        const gradeDistribution: Record<string, number> = { A: 0, B: 0, C: 0, S: 0, W: 0 };

        for (const m of marksList) {
            const val = typeof m.marks === 'number' ? m.marks : (m.total_score || 0);
            totalScore += val;
            if (m.grade && gradeDistribution[m.grade] !== undefined) {
                gradeDistribution[m.grade]++;
            }
        }

        const averageMark = totalSubjects > 0 ? Math.round((totalScore / totalSubjects) * 10) / 10 : 0;

        // Check if marks are finalized for this class/term/year
        let isFinalized = false;
        if (student.class_id) {
            const { data: finalization } = await db
                .from('term_finalizations')
                .select('is_finalized')
                .eq('tenant_id', tenantId)
                .eq('class_id', student.class_id)
                .eq('academic_year', year)
                .eq('term', currentTerm)
                .maybeSingle();

            isFinalized = Boolean(finalization?.is_finalized);
        }

        return {
            studentId: id,
            fullName: student.users?.full_name,
            admissionNo: student.admission_no,
            class: student.classes,
            academicYear: year,
            term: currentTerm,
            isFinalized,
            metrics: {
                totalSubjects,
                totalScore,
                averageMark,
                gradeDistribution,
            },
            marks: marksList,
        };
    }

    async updateProfile(id: string, dto: UpdateStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        // Fetch student to get user_id
        const { data: studentRow } = await db
            .from('students')
            .select('user_id')
            .eq('id', id)
            .maybeSingle();
        if (!studentRow) throw new NotFoundException(`Student ${id} not found`);

        // Update user profile fields
        if (dto.fullName || dto.phoneNumber || dto.avatarUrl) {
            await db.from('users')
                .update({
                    ...(dto.fullName && { full_name: dto.fullName }),
                    ...(dto.phoneNumber && { phone_number: dto.phoneNumber }),
                    ...(dto.avatarUrl && { avatar_url: dto.avatarUrl }),
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
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data: currentStudent } = await db
            .from('students')
            .select('class_id')
            .eq('id', id)
            .maybeSingle();

        if (!currentStudent) throw new NotFoundException(`Student ${id} not found`);

        if (dto.classId && currentStudent.class_id !== dto.classId) {
            await this.assertClassCapacity(tenantId, dto.classId);
        }

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
        await this.syncClassGroup(tenantId, dto.classId);
        return data;
    }

    /**
     * Keep the class group chat roster in step with the roll. Never fatal — a
     * failed sync must not roll back an enrolment or a class transfer.
     */
    private async syncClassGroup(tenantId: string, classId?: string | null): Promise<void> {
        if (!classId) return;
        try {
            await this.chat.syncClassParticipants(tenantId, classId);
        } catch (err: any) {
            this.logger.warn(`Class group sync skipped for ${classId}: ${err?.message}`);
        }
    }

    async deactivate(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data: studentRow } = await db.from('students').select('user_id').eq('id', id).maybeSingle();
        if (!studentRow) throw new NotFoundException(`Student ${id} not found`);

        const { error } = await db.from('users').update({ is_active: false }).eq('id', studentRow.user_id);
        if (error) throw new InternalServerErrorException('Failed to deactivate student');
        return { message: 'Student deactivated' };
    }
}
