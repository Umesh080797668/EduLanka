// =============================================================================
// School Policy Service
// =============================================================================
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdatePolicyDto } from './dto/policy.dto';

@Injectable()
export class SchoolPolicyService {
    private readonly logger = new Logger(SchoolPolicyService.name);

    constructor(
        private readonly supabase: SupabaseService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can update policy');
        }
    }


    async getPolicy(caller: JwtPayload) {
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        const { data, error } = await db.from('school_policy').select('*').limit(1).maybeSingle();
        if (error) throw new InternalServerErrorException('Failed to fetch school policy');
        if (!data) throw new NotFoundException('School policy not initialised. Re-provision this tenant.');
        return data;
    }

    async updatePolicy(dto: UpdatePolicyDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

        // Build update payload (snake_case for Supabase)
        const updatePayload: Record<string, unknown> = {};
        if (dto.academicYear !== undefined) updatePayload.academic_year = dto.academicYear;
        if (dto.maxStudentsPerClass !== undefined) updatePayload.max_students_per_class = dto.maxStudentsPerClass;
        if (dto.allowSelfEnrollment !== undefined) updatePayload.allow_self_enrollment = dto.allowSelfEnrollment;
        if (dto.smsEnabled !== undefined) {
            if (dto.smsEnabled) {
                // Must verify if system admin approved SMS for this tenant before allowing it to be turned on
                const { data: tenantData } = await this.supabase.adminClient
                    .from('tenants')
                    .select('sms_approved')
                    .eq('id', slug)
                    .maybeSingle();

                if (!tenantData?.sms_approved) {
                    throw new ForbiddenException('SMS notifications have not been approved for this tenant. Please contact a System Admin.');
                }
            }
            updatePayload.sms_enabled = dto.smsEnabled;
        }

        if (dto.defaultLanguage !== undefined) updatePayload.default_language = dto.defaultLanguage;
        if (dto.timezone !== undefined) updatePayload.timezone = dto.timezone;
        if (dto.schoolHoursStart !== undefined) updatePayload.school_hours_start = dto.schoolHoursStart;
        if (dto.schoolHoursEnd !== undefined) updatePayload.school_hours_end = dto.schoolHoursEnd;
        if (dto.supportedMediums !== undefined) updatePayload.supported_mediums = dto.supportedMediums;

        const { data: policyRow } = await db.from('school_policy').select('id').limit(1).maybeSingle();
        if (!policyRow) throw new NotFoundException('School policy not found');

        const { data, error } = await db
            .from('school_policy')
            .update(updatePayload)
            .eq('id', policyRow.id)
            .select()
            .maybeSingle();

        if (error) {
            this.logger.error(`Failed to update policy: ${error.message}`);
            throw new InternalServerErrorException('Failed to update school policy');
        }
        if (!data) throw new NotFoundException('School policy not found');
        return data;
    }
}
