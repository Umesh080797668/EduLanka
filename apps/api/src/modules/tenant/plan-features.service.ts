import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export enum PlanFeature {
    STATIC_REPORT_CARDS = 'static_report_cards',
    SCHOOL_NOTICES = 'school_notices',
    CHAT = 'chat',
    TARGETED_NOTICES = 'targeted_notices',
    DISASTER_MODE = 'disaster_mode',
    TWILIO_SMS = 'twilio_sms',
    BLOGS_SCHOOL = 'blogs_school',
    OFFLINE_SYNC = 'offline_sync',
    BLOGS_PLATFORM = 'blogs_platform',
    VIDEO_HOSTING = 'video_hosting',
    PAPER_HUB = 'paper_hub',
    AI_ASSISTANT = 'ai_assistant',
    EARLY_WARNING = 'early_warning',
    EXAM_PREDICTION = 'exam_prediction',
    TEACHER_ANALYTICS = 'teacher_analytics',
    SMART_TIMETABLE = 'smart_timetable',
}

/**
 * Canonical plan-feature matrix adhering strictly to EduLanka Phased Blueprint Section 7.
 * COMMUNITY is strictly limited to static report cards and school-wide broadcast notices.
 */
export const DEFAULT_PLAN_FEATURES: Record<string, string[]> = {
    COMMUNITY: [
        PlanFeature.STATIC_REPORT_CARDS,
        PlanFeature.SCHOOL_NOTICES,
    ],
    STARTER: [
        PlanFeature.STATIC_REPORT_CARDS,
        PlanFeature.SCHOOL_NOTICES,
        PlanFeature.CHAT,
        PlanFeature.TARGETED_NOTICES,
        PlanFeature.DISASTER_MODE,
        PlanFeature.TWILIO_SMS,
        PlanFeature.BLOGS_SCHOOL,
        PlanFeature.OFFLINE_SYNC,
    ],
    GROWTH: [
        PlanFeature.STATIC_REPORT_CARDS,
        PlanFeature.SCHOOL_NOTICES,
        PlanFeature.CHAT,
        PlanFeature.TARGETED_NOTICES,
        PlanFeature.DISASTER_MODE,
        PlanFeature.TWILIO_SMS,
        PlanFeature.BLOGS_SCHOOL,
        PlanFeature.OFFLINE_SYNC,
        PlanFeature.BLOGS_PLATFORM,
        PlanFeature.VIDEO_HOSTING,
        PlanFeature.PAPER_HUB,
        PlanFeature.AI_ASSISTANT,
    ],
    INSTITUTIONAL: [
        PlanFeature.STATIC_REPORT_CARDS,
        PlanFeature.SCHOOL_NOTICES,
        PlanFeature.CHAT,
        PlanFeature.TARGETED_NOTICES,
        PlanFeature.DISASTER_MODE,
        PlanFeature.TWILIO_SMS,
        PlanFeature.BLOGS_SCHOOL,
        PlanFeature.OFFLINE_SYNC,
        PlanFeature.BLOGS_PLATFORM,
        PlanFeature.VIDEO_HOSTING,
        PlanFeature.PAPER_HUB,
        PlanFeature.AI_ASSISTANT,
        PlanFeature.EARLY_WARNING,
        PlanFeature.EXAM_PREDICTION,
        PlanFeature.TEACHER_ANALYTICS,
        PlanFeature.SMART_TIMETABLE,
    ],
};

@Injectable()
export class PlanFeaturesService {
    private readonly logger = new Logger(PlanFeaturesService.name);
    private planFeaturesCache: Map<string, string[]> = new Map();
    private lastCacheUpdate = 0;
    private readonly CACHE_TTL_MS = 60_000; // 1 minute

    constructor(private readonly supabase: SupabaseService) {
        // Initialize with default blueprint matrix
        for (const [plan, features] of Object.entries(DEFAULT_PLAN_FEATURES)) {
            this.planFeaturesCache.set(plan, features);
        }
    }

    /**
     * Synchronously checks if a plan has a given feature enabled.
     */
    isFeatureEnabled(plan: string | undefined | null, feature: PlanFeature | string): boolean {
        const normalizedPlan = (plan || 'COMMUNITY').toUpperCase();
        const features = this.planFeaturesCache.get(normalizedPlan) || DEFAULT_PLAN_FEATURES[normalizedPlan] || [];

        // Legacy compatibility check for aliases
        if (feature === PlanFeature.CHAT && (features.includes('basic_chat') || features.includes('full_chat'))) {
            // Note: Community basic_chat was deprecated in Section 7. Chat strictly requires STARTER or above.
            return normalizedPlan !== 'COMMUNITY';
        }

        return features.includes(feature);
    }

    /**
     * Asserts that a plan has a feature, throwing ForbiddenException if not.
     */
    assertFeature(plan: string | undefined | null, feature: PlanFeature | string, customMessage?: string): void {
        if (!this.isFeatureEnabled(plan, feature)) {
            const normalizedPlan = (plan || 'COMMUNITY').toUpperCase();
            const msg = customMessage || `Feature "${feature}" is not available on the ${normalizedPlan} tier. Please upgrade your subscription.`;
            throw new ForbiddenException(msg);
        }
    }

    /**
     * Resolves the current plan of a tenant from database.
     */
    async getTenantPlan(tenantId: string): Promise<string> {
        if (!tenantId) return 'COMMUNITY';
        try {
            const query = this.supabase?.adminClient?.from?.('tenants');
            if (!query || typeof query.select !== 'function') {
                return 'COMMUNITY';
            }
            const { data, error } = await query
                .select('plan')
                .eq('id', tenantId)
                .maybeSingle();

            if (error || !data?.plan) {
                // Fail closed: Never unlock paid features during database hiccups or missing records
                return 'COMMUNITY';
            }
            return data.plan;
        } catch {
            return 'COMMUNITY';
        }
    }

    /**
     * Asserts that a tenant's plan supports the given feature.
     */
    async assertTenantFeature(tenantId: string, feature: PlanFeature | string, customMessage?: string): Promise<void> {
        const plan = await this.getTenantPlan(tenantId);
        this.assertFeature(plan, feature, customMessage);
    }

    /**
     * Refreshes the cached features from public.plans table.
     */
    async refreshCache(): Promise<void> {
        const now = Date.now();
        if (now - this.lastCacheUpdate < this.CACHE_TTL_MS) return;

        try {
            const { data, error } = await this.supabase.adminClient
                .from('plans')
                .select('code, features');

            if (error || !data) return;

            for (const row of data) {
                if (row.code && Array.isArray(row.features)) {
                    this.planFeaturesCache.set(row.code.toUpperCase(), row.features);
                }
            }
            this.lastCacheUpdate = now;
        } catch (err: any) {
            this.logger.warn(`Failed to refresh plan features cache: ${err?.message}`);
        }
    }
}
