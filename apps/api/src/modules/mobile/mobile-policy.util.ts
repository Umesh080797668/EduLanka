import type { SupabaseService } from '../supabase/supabase.service';

export interface SchoolPolicyRecord {
    id: string;
    tenant_id: string;
    academic_year: number;
    max_students_per_class?: number;
    timezone?: string;
    default_language?: string;
    sms_enabled?: boolean;
    school_hours_start?: string;
    school_hours_end?: string;
    supported_mediums?: string[];
    extra_config?: {
        phone?: string;
        emergency_phone?: string;
        emergency_contacts?: any[];
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Centralized, deduplicated school policy lookup for tenant mobile services.
 */
export async function getTenantSchoolPolicy(
    supabase: SupabaseService,
    tenantId: string,
): Promise<SchoolPolicyRecord | null> {
    const { data: policy, error } = await supabase.adminClient
        .from('school_policy')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

    if (error) {
        return null;
    }
    return policy as SchoolPolicyRecord | null;
}
