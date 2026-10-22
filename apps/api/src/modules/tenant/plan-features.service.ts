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
    // ── Independent Learner tiers (Blueprint §7d) ─────────────────────────────
    // FREE_INDIVIDUAL: 5 AI queries/day, 200 MB storage
    FREE_INDIVIDUAL: [
        PlanFeature.AI_ASSISTANT,
        PlanFeature.PAPER_HUB,
    ],
    // INDIVIDUAL_PRO: LKR 299/mo, 20,000 AI tokens/month, 2 GB storage
    INDIVIDUAL_PRO: [
        PlanFeature.AI_ASSISTANT,
        PlanFeature.PAPER_HUB,
        PlanFeature.OFFLINE_SYNC,
        PlanFeature.VIDEO_HOSTING,
    ],
    // INDIVIDUAL_PREMIUM: LKR 599/mo, 60,000 AI tokens/month, 8 GB storage
    INDIVIDUAL_PREMIUM: [
        PlanFeature.AI_ASSISTANT,
        PlanFeature.PAPER_HUB,
        PlanFeature.OFFLINE_SYNC,
        PlanFeature.VIDEO_HOSTING,
        PlanFeature.EARLY_WARNING,
        PlanFeature.EXAM_PREDICTION,
    ],
};

/** Quota limits per individual learner plan (Blueprint §7d) */
export const INDIVIDUAL_PLAN_QUOTAS: Record<string, {
    aiQueriesPerDay: number;
    aiTokensPerMonth: number;
    storageMb: number;
}> = {
    FREE_INDIVIDUAL: {
        aiQueriesPerDay: 5,
        aiTokensPerMonth: 0,   // daily-query model, not token-based
        storageMb: 200,
    },
    INDIVIDUAL_PRO: {
        aiQueriesPerDay: Infinity,
        aiTokensPerMonth: 20_000,
        storageMb: 2_048,
    },
    INDIVIDUAL_PREMIUM: {
        aiQueriesPerDay: Infinity,
        aiTokensPerMonth: 60_000,
        storageMb: 8_192,
    },
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
     * Enforces Blueprint §7d per-plan quotas for Independent Learner AI queries.
     * Throws ForbiddenException when the daily (FREE_INDIVIDUAL) or monthly
     * (INDIVIDUAL_PRO / INDIVIDUAL_PREMIUM) AI quota would be exceeded.
     *
     * @param plan          - The learner's IndividualPlan code
     * @param userId        - The public.users.id (used as Redis quota key)
     * @param redisClient   - An ioredis-compatible client for atomic quota ops
     */
    async assertIndividualAiQuota(
        plan: string,
        userId: string,
        redisClient: { get: (key: string) => Promise<string | null>; incr: (key: string) => Promise<number>; expire: (key: string, seconds: number) => Promise<number> },
    ): Promise<void> {
        const quotas = INDIVIDUAL_PLAN_QUOTAS[plan];
        if (!quotas) {
            // Unknown individual plan — fail closed
            throw new ForbiddenException(`Unknown individual plan: ${plan}`);
        }

        if (!this.isFeatureEnabled(plan, PlanFeature.AI_ASSISTANT)) {
            throw new ForbiddenException('AI Assistant is not available on your current plan.');
        }

        const normalizedPlan = plan.toUpperCase();

        if (normalizedPlan === 'FREE_INDIVIDUAL') {
            // Daily limit: 5 AI queries per UTC day
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const key = `edulanka:ai:daily:${userId}:${today}`;
            const current = await redisClient.get(key);
            const count = current ? parseInt(current, 10) : 0;
            if (count >= quotas.aiQueriesPerDay) {
                throw new ForbiddenException(
                    `FREE_INDIVIDUAL plan limit reached: ${quotas.aiQueriesPerDay} AI queries per day. Upgrade to Individual Pro for 20,000 tokens/month.`,
                );
            }
            const newCount = await redisClient.incr(key);
            if (newCount === 1) {
                // Set TTL to midnight of the next UTC day (86400 s max)
                await redisClient.expire(key, 86400);
            }
        } else {
            // Monthly token limit for PRO / PREMIUM — enforcement is best-effort at this layer;
            // the AI gateway must track actual token consumption. This guard is a pre-flight check.
            const month = new Date().toISOString().slice(0, 7); // YYYY-MM
            const key = `edulanka:ai:monthly_tokens:${userId}:${month}`;
            const current = await redisClient.get(key);
            const used = current ? parseInt(current, 10) : 0;
            if (used >= quotas.aiTokensPerMonth) {
                throw new ForbiddenException(
                    `Monthly AI token quota exhausted for plan ${normalizedPlan} (${quotas.aiTokensPerMonth.toLocaleString()} tokens/month). ` +
                    `Quota resets on the 1st of next month or upgrade to Individual Premium.`,
                );
            }
        }
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
