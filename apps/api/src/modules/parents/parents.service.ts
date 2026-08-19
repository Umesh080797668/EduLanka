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
import { LinkStudentDto, CreateParentDto, UpdateParentDto } from './dto/parent.dto';

@Injectable()
export class ParentsService {
    private readonly logger = new Logger(ParentsService.name);

    constructor(
        private readonly supabase: SupabaseService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage parent-student links');
        }
    }

    async create(dto: CreateParentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const authPayload: any = {
            password: dto.temporaryPassword,
        };

        if (dto.email) {
            authPayload.email = dto.email;
            authPayload.email_confirm = true;
        } else if (dto.phoneNumber) {
            authPayload.phone = dto.phoneNumber;
            authPayload.phone_confirm = true;
        } else {
            throw new InternalServerErrorException('Parent must possess either an email or phone number explicitly.');
        }

        const { data: authData, error: authErr } = await this.supabase.adminClient.auth.admin.createUser(authPayload);

        if (authErr || !authData.user) {
            this.logger.error(`Supabase auth createUser failed: ${authErr?.message}`);
            throw new InternalServerErrorException('Failed to create authentication account');
        }

        const authUid = authData.user.id;

        try {
            const { data: userRow, error: userErr } = await db
                .from('users')
                .insert({
                    user_id: authUid,
                    tenant_id: slug,
                    email: dto.email || null,
                    full_name: dto.fullName,
                    phone_number: dto.phoneNumber || null,
                    role: UserRole.PARENT,
                    is_active: true,
                })
                .select()
                .single();

            if (userErr) throw userErr;
            return userRow;
        } catch (error: any) {
            await this.supabase.adminClient.auth.admin.deleteUser(authUid);
            if (error.code === '23505') throw new ConflictException('A parent with this email already exists in this tenant');
            this.logger.error(`Failed to insert parent user record: ${error.message}`);
            throw new InternalServerErrorException('Failed to provision parent profile');
        }
    }


    async update(id: string, dto: UpdateParentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const updates: any = {};
        if (dto.fullName) updates.full_name = dto.fullName;
        if (dto.email !== undefined) updates.email = dto.email || null;
        if (dto.phoneNumber !== undefined) updates.phone_number = dto.phoneNumber || null;
        if (dto.avatarUrl !== undefined) updates.avatar_url = dto.avatarUrl || null;

        if (Object.keys(updates).length === 0) return { message: 'No updates provided' };

        const { data, error } = await db
            .from('users')
            .update(updates)
            .eq('id', id)
            .eq('role', UserRole.PARENT)
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to update parent: ${error.message}`);
            throw new InternalServerErrorException('Failed to update parent');
        }

        return data;
    }

    async deactivate(parentUserId: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db
            .from('users')
            .update({ is_active: false })
            .eq('id', parentUserId)
            .eq('role', UserRole.PARENT);

        if (error) {
            this.logger.error(`Failed to deactivate parent: ${error.message}`);
            throw new InternalServerErrorException('Failed to deactivate parent');
        }
        return { message: 'Parent deactivated successfully' };
    }

    async getMe(caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data: userData, error: userError } = await db
            .from('users')
            .select('*')
            .eq('id', caller.sub)
            .eq('role', UserRole.PARENT)
            .maybeSingle();

        if (userError) {
            console.error("PARENTS_ERROR:", userError);
            throw new InternalServerErrorException('Failed to fetch parent profile: ' + userError.message);
        }
        if (!userData) throw new NotFoundException('Parent profile not found');

        const { data: childrenData, error: childrenError } = await db
            .from('parents')
            .select('student_id, students(id, admission_no, classes(grade, section, year), users(full_name, email))')
            .eq('user_id', caller.sub);

        if (childrenError) {
            console.error("PARENTS_CHILDREN_ERROR:", childrenError);
            // Non-fatal, just log it and fallback to empty array
        }

        return {
            users: { full_name: userData.full_name, email: userData.email },
            children: (childrenData || []).map((pc: any) => ({
                id: pc.student_id,
                name: pc.students?.users?.full_name,
                grade: pc.students?.classes ? `${pc.students.classes.grade} ${pc.students.classes.section}` : 'N/A',
                gpa: null,
                attendance: null
            }))
        };
    }

    async findAll(caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('users')
            .select('*, parents(id, student_id, relationship)')
            .eq('role', UserRole.PARENT)
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to fetch parents');
        return data ?? [];
    }

    async findOne(parentUserId: string, caller: JwtPayload) {
        if (parentUserId === 'undefined') throw new NotFoundException('Invalid parent UUID format');
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('users')
            .select('*, parents(id, student_id, relationship, students(id, admission_no, users(full_name, email)))')
            .eq('id', parentUserId)
            .eq('role', UserRole.PARENT)
            .maybeSingle();

        if (error) {
            if (error.code === '22P02') throw new NotFoundException('Invalid parent UUID format');
            throw new InternalServerErrorException('Failed to fetch parent: ' + error.message);
        }
        if (!data) throw new NotFoundException(`Parent ${parentUserId} not found`);
        return data;
    }

    async getChildren(parentUserId: string, caller: JwtPayload) {
        if (parentUserId === 'undefined') throw new NotFoundException('Invalid parent UUID format');
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db
            .from('parents')
            .select('*, students(id, admission_no, al_stream, users(full_name, email), classes(grade, section, year))')
            .eq('user_id', parentUserId);

        if (error) {
            if (error.code === '22P02') throw new NotFoundException('Invalid parent UUID format');
            throw new InternalServerErrorException('Failed to fetch children');
        }
        return data ?? [];
    }

    async linkToStudent(parentUserId: string, dto: LinkStudentDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
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
            .from('parents')
            .insert({
                tenant_id: slug,
                user_id: parentUserId,
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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { error } = await db
            .from('parents')
            .delete()
            .eq('user_id', parentUserId)
            .eq('student_id', studentId);

        if (error) throw new InternalServerErrorException('Failed to unlink parent from student');
        return { message: 'Parent unlinked from student' };
    }
}
