-- =============================================================================
-- Migration: 20260829000000_phase2_fixes_and_security.sql
-- Description:
--   1. Harden views (tenant_sms_quotas, monthly_sms_usage) with security_invoker
--      and revoke access from anon and authenticated to prevent RLS bypass.
--   2. Fix monthly_sms_usage to count actual billable segment_count excluding FAILED.
--   3. Partial unique index on disaster_events(tenant_id) WHERE is_active (with pre-cleanup).
--   4. Atomic stored procedures for disaster mode activation & deactivation (with DISASTER_NOT_ACTIVE check).
--   5. Atomic stored procedure for disaster SMS delivery count increment.
--   6. Revoke function execution privileges from PUBLIC, anon, authenticated on all RPC functions.
--   7. Alter default privileges to revoke EXECUTE on functions from anon, authenticated.
--   8. Revoke permissions from anon/authenticated on legacy tenant_% schemas.
-- =============================================================================

-- 1. Clean up duplicate active events (keep only the latest active event per tenant)
--    This prevents the unique index creation from failing on legacy data.
WITH ranked_events AS (
    SELECT id, tenant_id,
           ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY activated_at DESC NULLS LAST, created_at DESC) as rn
    FROM public.disaster_events
    WHERE is_active = true
)
UPDATE public.disaster_events
SET is_active = false,
    deactivated_at = COALESCE(deactivated_at, now()),
    details = CASE 
        WHEN details IS NOT NULL THEN details || ' | Deactivated during duplicate index preparation'
        ELSE 'Deactivated during duplicate index preparation'
    END,
    updated_at = now()
WHERE id IN (
    SELECT id FROM ranked_events WHERE rn > 1
);

-- Ensure disaster_mode column exists on public.tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS disaster_mode BOOLEAN NOT NULL DEFAULT false;

-- Partial Unique Index to prevent concurrent / duplicate active disaster events
CREATE UNIQUE INDEX IF NOT EXISTS idx_disaster_events_active_tenant 
    ON public.disaster_events(tenant_id) 
    WHERE is_active = true;

-- 2. Atomic Disaster Mode Activation Function (single transaction, returns 409 conflict if active)
CREATE OR REPLACE FUNCTION public.activate_disaster_mode(
    p_tenant_id UUID,
    p_triggered_by UUID,
    p_reason TEXT,
    p_details TEXT DEFAULT NULL,
    p_resume_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_active BOOLEAN;
    v_event_id UUID;
    v_event JSONB;
BEGIN
    -- Check if disaster mode is already active on the tenant
    SELECT disaster_mode INTO v_is_active
    FROM public.tenants
    WHERE id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_is_active IS TRUE THEN
        RAISE EXCEPTION 'DISASTER_ALREADY_ACTIVE' USING ERRCODE = '23505';
    END IF;

    -- Also verify no active row exists in disaster_events
    IF EXISTS (SELECT 1 FROM public.disaster_events WHERE tenant_id = p_tenant_id AND is_active = true) THEN
        RAISE EXCEPTION 'DISASTER_ALREADY_ACTIVE' USING ERRCODE = '23505';
    END IF;

    -- 1. Insert historical disaster event
    INSERT INTO public.disaster_events (
        tenant_id,
        triggered_by,
        reason,
        details,
        expected_resume_date,
        is_active,
        activated_at,
        created_at,
        updated_at
    ) VALUES (
        p_tenant_id,
        p_triggered_by,
        p_reason,
        p_details,
        p_resume_date,
        true,
        now(),
        now(),
        now()
    ) RETURNING id INTO v_event_id;

    -- 2. Update tenant record atomically
    UPDATE public.tenants
    SET 
        disaster_mode = true,
        disaster_reason = p_reason,
        disaster_resume_date = p_resume_date,
        updated_at = now()
    WHERE id = p_tenant_id;

    SELECT to_jsonb(e.*) INTO v_event
    FROM public.disaster_events e
    WHERE e.id = v_event_id;

    RETURN v_event;
END;
$$;

-- 3. Atomic Disaster Mode Deactivation Function
CREATE OR REPLACE FUNCTION public.deactivate_disaster_mode(
    p_tenant_id UUID,
    p_deactivated_by UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_active BOOLEAN;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- Verify that Disaster Mode is actually active for this school
    SELECT disaster_mode INTO v_is_active
    FROM public.tenants
    WHERE id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TENANT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'DISASTER_NOT_ACTIVE' USING ERRCODE = 'P0002';
    END IF;

    -- 1. Deactivate active disaster events
    UPDATE public.disaster_events
    SET 
        is_active = false,
        deactivated_at = v_now,
        deactivated_by = p_deactivated_by,
        details = CASE 
            WHEN p_note IS NOT NULL AND details IS NOT NULL THEN details || ' | Deactivation note: ' || p_note
            WHEN p_note IS NOT NULL THEN 'Deactivation note: ' || p_note
            ELSE details
        END,
        updated_at = v_now
    WHERE tenant_id = p_tenant_id AND is_active = true;

    -- 2. Clear tenant flags
    UPDATE public.tenants
    SET 
        disaster_mode = false,
        disaster_reason = null,
        disaster_resume_date = null,
        updated_at = v_now
    WHERE id = p_tenant_id;

    RETURN jsonb_build_object('success', true, 'deactivated_at', v_now);
END;
$$;

-- 4. Atomic Disaster Delivery Increment Function (avoids read-modify-write lost updates)
CREATE OR REPLACE FUNCTION public.increment_disaster_sms_count(
    p_event_id UUID,
    p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_status = 'DELIVERED' THEN
        UPDATE public.disaster_events
        SET sms_delivered_count = sms_delivered_count + 1,
            updated_at = now()
        WHERE id = p_event_id;
    ELSIF p_status = 'FAILED' THEN
        UPDATE public.disaster_events
        SET sms_failed_count = sms_failed_count + 1,
            updated_at = now()
        WHERE id = p_event_id;
    END IF;
END;
$$;

-- 5. Revoke execute privileges on RPC functions from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public.activate_disaster_mode(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deactivate_disaster_mode(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_disaster_sms_count(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.activate_disaster_mode(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_disaster_mode(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_disaster_sms_count(UUID, TEXT) TO service_role;

-- Revoke exec_sql if exists to eliminate arbitrary SQL vulnerability
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'exec_sql') THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC, anon, authenticated;';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO service_role;';
    END IF;
END;
$$;

-- Alter default privileges so future public functions are not auto-granted to anon/authenticated
-- Explicitly cover both the current executing role and standard Supabase administrative roles
DO $$
DECLARE
    v_role TEXT;
BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;';

    FOR v_role IN SELECT unnest(ARRAY['postgres', 'authenticated', 'anon', 'service_role']) LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
            BEGIN
                EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;', v_role);
            EXCEPTION WHEN insufficient_privilege THEN
                NULL;
            END;
        END IF;
    END LOOP;
END;
$$;

-- 6. Fix monthly_sms_usage view to sum actual segments and exclude failures from total_dispatched
DROP VIEW IF EXISTS public.tenant_sms_quotas CASCADE;
DROP VIEW IF EXISTS public.monthly_sms_usage CASCADE;

CREATE OR REPLACE VIEW public.monthly_sms_usage AS
SELECT 
    tenant_id,
    DATE_TRUNC('month', created_at) AS billing_month,
    COALESCE(SUM(CASE WHEN status != 'FAILED' THEN COALESCE(segment_count, 1) ELSE 0 END), 0)::BIGINT AS total_dispatched,
    COALESCE(SUM(CASE WHEN status = 'FAILED' THEN COALESCE(segment_count, 1) ELSE 0 END), 0)::BIGINT AS total_failed,
    COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN COALESCE(segment_count, 1) ELSE 0 END), 0)::BIGINT AS total_delivered
FROM public.sms_logs
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- 7. Recreate tenant_sms_quotas view
--    Fix: Join active students strictly against active users so inactive students are not counted.
CREATE OR REPLACE VIEW public.tenant_sms_quotas AS
WITH active_students AS (
    SELECT 
        s.tenant_id,
        COUNT(s.id) AS student_count
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id AND u.is_active = true
    GROUP BY s.tenant_id
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

-- 8. View Security: SET security_invoker = true and REVOKE from anon and authenticated
ALTER VIEW public.monthly_sms_usage SET (security_invoker = true);
ALTER VIEW public.tenant_sms_quotas SET (security_invoker = true);

REVOKE ALL ON public.monthly_sms_usage FROM anon, authenticated;
REVOKE ALL ON public.tenant_sms_quotas FROM anon, authenticated;
GRANT SELECT ON public.monthly_sms_usage TO service_role;
GRANT SELECT ON public.tenant_sms_quotas TO service_role;

-- 9. Lock down legacy tenant_% schemas if any exist
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    ) LOOP
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM anon, authenticated;', r.schema_name);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon, authenticated;', r.schema_name);
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM anon, authenticated;', r.schema_name);
        EXECUTE format('REVOKE USAGE ON SCHEMA %I FROM anon, authenticated;', r.schema_name);
    END LOOP;
END;
$$;

-- 10. Add is_archived to notices
ALTER TABLE public.notices 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
