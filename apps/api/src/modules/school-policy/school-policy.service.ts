// =============================================================================
// School Policy Service
// =============================================================================
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service';

import { UpdatePolicyDto } from './dto/policy.dto';

export const DEFAULT_SCHOOL_POLICY = {
    academic_year: new Date().getFullYear(),
    max_students_per_class: 40,
    allow_self_enrollment: false,
    sms_enabled: false,
    default_language: 'si',
    timezone: 'Asia/Colombo',
    school_hours_start: '07:30:00',
    school_hours_end: '13:30:00',
    supported_mediums: ['SINHALA', 'ENGLISH', 'TAMIL'],
};

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

    /**
     * Retrieves the effective school policy for a tenant.
     * Never throws a 500 or 404 when a newly provisioned tenant lacks a database row;
     * returns standard global default parameters and optionally backfills the record.
     */
    async getEffectivePolicy(callerOrTenantId: JwtPayload | string) {
        const tenantId = typeof callerOrTenantId === 'string' ? callerOrTenantId : callerOrTenantId.tenantId;

        const { data, error } = await this.supabase.adminClient
            .from('school_policy')
            .select('*')
            .eq('tenant_id', tenantId)
            .limit(1)
            .maybeSingle();

        if (error) {
            this.logger.warn(`Failed to fetch policy for tenant ${tenantId}: ${error.message}. Returning default global policy.`);
            return {
                id: `default-${tenantId}`,
                tenant_id: tenantId,
                ...DEFAULT_SCHOOL_POLICY,
            };
        }

        if (!data) {
            this.logger.log(`No school_policy row found for newly provisioned tenant ${tenantId}. Returning defaults.`);
            return {
                id: `default-${tenantId}`,
                tenant_id: tenantId,
                ...DEFAULT_SCHOOL_POLICY,
            };
        }

        return data;
    }

    async getPolicy(caller: JwtPayload) {
        return this.getEffectivePolicy(caller);
    }

    async updatePolicy(dto: UpdatePolicyDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;

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
                    .eq('id', tenantId)
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

        const { data: policyRow } = await this.supabase.adminClient
            .from('school_policy')
            .select('id')
            .eq('tenant_id', tenantId)
            .limit(1)
            .maybeSingle();
        if (!policyRow) throw new NotFoundException('School policy not found');

        const { data, error } = await this.supabase.adminClient
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
