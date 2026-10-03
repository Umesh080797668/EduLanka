-- =============================================================================
-- Migration: 20260828000000_phase2_disaster_maintenance_and_quotas.sql
-- Description: Phase 2 spec alignment:
--   1. Disaster Mode taxonomy enum & disaster_events history tracking
--   2. Link sms_logs with disaster_event_id and segment tracking
--   3. System Maintenance Notices entity (disambiguated from Disaster Mode)
--   4. Dynamic per-student SMS quota calculation (3 SMS/student on Starter)
-- =============================================================================

-- 1. Disaster Events History Table (keeps data Phase 5 and 6 need)
CREATE TABLE IF NOT EXISTS public.disaster_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    triggered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('FLOOD', 'CYCLONE', 'LANDSLIDE', 'CIVIL_PUBLIC_HEALTH', 'OTHER')),
    details TEXT,
    expected_resume_date TIMESTAMPTZ,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sms_queued_count INTEGER NOT NULL DEFAULT 0,
    sms_delivered_count INTEGER NOT NULL DEFAULT 0,
    sms_failed_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disaster_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_disaster_events" ON public.disaster_events;
CREATE POLICY "tenant_disaster_events" ON public.disaster_events FOR ALL 
    USING ((tenant_id)::text = current_setting('request.jwt.claim.tenantId', true));

-- 2. Link sms_logs with disaster events and segment counts
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS disaster_event_id UUID REFERENCES public.disaster_events(id) ON DELETE SET NULL;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS segment_count SMALLINT DEFAULT 1;

-- 3. Taxonomy Check Constraint on tenants
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_disaster_reason_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_disaster_reason_check 
    CHECK (disaster_reason IS NULL OR disaster_reason IN ('FLOOD', 'CYCLONE', 'LANDSLIDE', 'CIVIL_PUBLIC_HEALTH', 'OTHER'));

-- 4. System Maintenance Notices (platform downtime/upgrades, separate from Disaster Mode)
CREATE TABLE IF NOT EXISTS public.system_maintenance_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    scheduled_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    scheduled_end TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_maintenance_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all_can_read_maintenance_notices" ON public.system_maintenance_notices;
CREATE POLICY "all_can_read_maintenance_notices" ON public.system_maintenance_notices FOR SELECT USING (true);

-- 5. Dynamic per-student SMS quota view
DROP VIEW IF EXISTS public.tenant_sms_quotas CASCADE;
CREATE OR REPLACE VIEW public.tenant_sms_quotas AS
WITH active_students AS (
    SELECT 
        t.id AS tenant_id,
        COUNT(s.id) AS student_count
    FROM public.tenants t
    LEFT JOIN public.students s ON s.tenant_id = t.id
    LEFT JOIN public.users u ON u.id = s.user_id AND u.is_active = true
    GROUP BY t.id
)
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.plan,
    COALESCE(ast.student_count, 0) AS active_student_count,
    CASE 
        WHEN t.plan = 'COMMUNITY' THEN 0
        WHEN t.plan = 'STARTER' THEN GREATEST(COALESCE(ast.student_count, 0) * 3, 100)
        WHEN t.plan = 'GROWTH' THEN GREATEST(COALESCE(ast.student_count, 0) * 5, 500)
        WHEN t.plan = 'INSTITUTIONAL' THEN GREATEST(COALESCE(ast.student_count, 0) * 8, 2000)
        ELSE 0 
    END AS monthly_quota,
    COALESCE(u.total_dispatched, 0) AS current_month_usage,
    COALESCE(u.total_delivered, 0) AS successful_deliveries,
    COALESCE(u.total_failed, 0) AS failed_deliveries,
    CASE 
        WHEN t.plan = 'COMMUNITY' THEN COALESCE(u.total_dispatched, 0)
        WHEN COALESCE(u.total_dispatched, 0) > (
            CASE 
                WHEN t.plan = 'STARTER' THEN GREATEST(COALESCE(ast.student_count, 0) * 3, 100)
                WHEN t.plan = 'GROWTH' THEN GREATEST(COALESCE(ast.student_count, 0) * 5, 500)
                WHEN t.plan = 'INSTITUTIONAL' THEN GREATEST(COALESCE(ast.student_count, 0) * 8, 2000)
                ELSE 0 
            END
        ) THEN COALESCE(u.total_dispatched, 0) - (
            CASE 
                WHEN t.plan = 'STARTER' THEN GREATEST(COALESCE(ast.student_count, 0) * 3, 100)
                WHEN t.plan = 'GROWTH' THEN GREATEST(COALESCE(ast.student_count, 0) * 5, 500)
                WHEN t.plan = 'INSTITUTIONAL' THEN GREATEST(COALESCE(ast.student_count, 0) * 8, 2000)
                ELSE 0 
            END
        )
        ELSE 0
    END AS overage_count
FROM public.tenants t
LEFT JOIN active_students ast ON t.id = ast.tenant_id
LEFT JOIN public.monthly_sms_usage u 
    ON t.id = u.tenant_id 
    AND u.billing_month = DATE_TRUNC('month', NOW());
