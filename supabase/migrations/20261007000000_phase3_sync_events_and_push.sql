-- =============================================================================
-- Migration: 20261007000000_phase3_sync_events_and_push.sql
-- Description:
-- Phase 3 Sprint 0 Foundation:
-- 0. Ensure system_root tenant exists for platform administration in migrated databases.
-- 1. Create public.tenant_sync_counters for monotonic per-tenant sequence assignment.
--    - Auto-initialized on tenant creation via trigger.
--    - Backfilled for all existing tenants.
-- 2. Create public.sync_events table for Event-Sourced Push Sync Engine.
--    - Uses UUID for entity_id.
--    - Enforces UNIQUE (tenant_id, client_uuid) per-tenant idempotency.
--    - Enforces UNIQUE (tenant_id, sequence) per-tenant monotonic ordering.
-- 3. Atomic sequence allocation function: public.append_sync_event(...)
--    - SECURITY DEFINER with fixed search_path = public, pg_temp.
--    - REVOKE from anon/authenticated, strictly GRANT to service_role.
-- 4. Create public.device_tokens table for FCM Push Registry.
--    - Token ownership re-assignment on re-registration.
-- 5. Exclude system_root from tenant_sms_quotas view and secure it.
-- 6. Secure RLS policies:
--    - NO permissive service_role policies (prevents PUBLIC role leak).
--    - Explicit REVOKE from anon/authenticated.
-- =============================================================================

-- 0. Insert the system-root tenant row for platform administration
INSERT INTO public.tenants (
    id,
    name,
    slug,
    plan,
    status,
    school_type,
    contact_email,
    address_city,
    address_district,
    address_province
) VALUES (
    '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
    'System Administration',
    'system_root',
    'COMMUNITY',
    'ACTIVE',
    'TYPE_1AB',
    'admin@edulanka.lk',
    'Colombo',
    'Colombo',
    'Western Province'
) ON CONFLICT (id) DO NOTHING;


-- 1. Per-Tenant Monotonic Sync Sequence Counter
CREATE TABLE IF NOT EXISTS public.tenant_sync_counters (
    tenant_id       UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    last_sequence   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_sync_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_sync_counters FROM anon, authenticated;
GRANT ALL ON public.tenant_sync_counters TO service_role;

-- Trigger to auto-create tenant counter row on tenant creation
CREATE OR REPLACE FUNCTION public.trg_init_tenant_sync_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.tenant_sync_counters (tenant_id, last_sequence, updated_at)
    VALUES (NEW.id, 0, NOW())
    ON CONFLICT (tenant_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_sync_counter_init ON public.tenants;
CREATE TRIGGER trg_tenant_sync_counter_init
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.trg_init_tenant_sync_counter();

-- Backfill counter row for all existing tenants
INSERT INTO public.tenant_sync_counters (tenant_id, last_sequence, updated_at)
SELECT id, 0, NOW()
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;


-- 2. Sync Events Table (Event-Sourced Push Stream)
CREATE TABLE IF NOT EXISTS public.sync_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL,                                              -- 'attendance', 'homework_submission', 'chat_message'
    entity_id       UUID NOT NULL,                                              -- Strong UUID key
    event_type      TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'DELETED')),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_uuid     TEXT,                                                       -- Client idempotency key (UUIDv4)
    sequence        BIGINT NOT NULL,                                            -- Monotonic sequence allocated per tenant
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, client_uuid),
    CONSTRAINT uq_sync_events_tenant_seq UNIQUE (tenant_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_sync_events_tenant_seq ON public.sync_events (tenant_id, sequence);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON public.sync_events (tenant_id, entity_type, sequence);

-- Ensure UNIQUE (tenant_id, sequence) constraint exists if table already existed prior to migration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_sync_events_tenant_seq'
    ) THEN
        ALTER TABLE public.sync_events
        ADD CONSTRAINT uq_sync_events_tenant_seq UNIQUE (tenant_id, sequence);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

-- Drop any previous permissive/leaky policies
DROP POLICY IF EXISTS "service_role_all_sync_events" ON public.sync_events;
DROP POLICY IF EXISTS "tenant_sync_events_select" ON public.sync_events;

-- Service role inherently bypasses RLS in Postgres.
-- Completely revoke direct client-facing access (PostgREST) from both anon and authenticated.
-- All sync traffic MUST traverse the backend API endpoints.
REVOKE ALL ON public.sync_events FROM anon, authenticated;
GRANT ALL ON public.sync_events TO service_role;


-- 3. Atomic Sequence Allocation and Event Ingestion Function
CREATE OR REPLACE FUNCTION public.append_sync_event(
    p_tenant_id   UUID,
    p_entity_type TEXT,
    p_entity_id   UUID,
    p_event_type  TEXT,
    p_payload     JSONB DEFAULT '{}'::jsonb,
    p_client_uuid TEXT DEFAULT NULL
)
RETURNS public.sync_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing_event public.sync_events;
    v_next_sequence  BIGINT;
    v_new_event      public.sync_events;
BEGIN
    -- 1. Idempotency check: if client_uuid is supplied and already recorded for this tenant, return it
    IF p_client_uuid IS NOT NULL THEN
        SELECT * INTO v_existing_event
        FROM public.sync_events
        WHERE tenant_id = p_tenant_id AND client_uuid = p_client_uuid;

        IF FOUND THEN
            RETURN v_existing_event;
        END IF;
    END IF;

    -- 2. Increment per-tenant sequence atomically
    INSERT INTO public.tenant_sync_counters (tenant_id, last_sequence, updated_at)
    VALUES (p_tenant_id, 1, NOW())
    ON CONFLICT (tenant_id) DO UPDATE
    SET last_sequence = public.tenant_sync_counters.last_sequence + 1,
        updated_at = NOW()
    RETURNING last_sequence INTO v_next_sequence;

    -- 3. Insert sync event with the allocated sequence
    INSERT INTO public.sync_events (
        tenant_id,
        entity_type,
        entity_id,
        event_type,
        payload,
        client_uuid,
        sequence,
        created_at
    ) VALUES (
        p_tenant_id,
        p_entity_type,
        p_entity_id,
        p_event_type,
        COALESCE(p_payload, '{}'::jsonb),
        p_client_uuid,
        v_next_sequence,
        NOW()
    )
    RETURNING * INTO v_new_event;

    RETURN v_new_event;
END;
$$;

-- Secure the function: revoke execute from public/anon/authenticated and grant to service_role only
REVOKE ALL ON FUNCTION public.append_sync_event(UUID, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_sync_event(UUID, TEXT, UUID, TEXT, JSONB, TEXT) TO service_role;


-- 4. Device Tokens Table (FCM Push Registry)
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,
    platform        TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_model    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_tenant_user ON public.device_tokens (tenant_id, user_id) WHERE is_active = TRUE;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Drop any previous permissive/leaky policies
DROP POLICY IF EXISTS "service_role_all_device_tokens" ON public.device_tokens;
DROP POLICY IF EXISTS "user_device_tokens_select" ON public.device_tokens;
DROP POLICY IF EXISTS "user_device_tokens_update" ON public.device_tokens;

REVOKE ALL ON public.device_tokens FROM anon, authenticated;
GRANT ALL ON public.device_tokens TO service_role;


-- 5. Exclude system_root from tenant_sms_quotas view
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
    AND u.billing_month = DATE_TRUNC('month', NOW())
WHERE t.slug != 'system_root';

ALTER VIEW public.tenant_sms_quotas SET (security_invoker = true);
REVOKE ALL ON public.tenant_sms_quotas FROM anon, authenticated;
GRANT ALL ON public.tenant_sms_quotas TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

