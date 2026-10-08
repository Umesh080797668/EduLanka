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
    client_uuid     TEXT NOT NULL,                                              -- Client idempotency key (UUIDv4)
    sequence        BIGINT NOT NULL,                                            -- Monotonic sequence allocated per tenant
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, client_uuid),
    CONSTRAINT uq_sync_events_tenant_seq UNIQUE (tenant_id, sequence)
);

-- Ensure client_uuid is NOT NULL if table already existed prior to migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sync_events' AND column_name = 'client_uuid' AND is_nullable = 'YES'
    ) THEN
        DELETE FROM public.sync_events WHERE client_uuid IS NULL;
        ALTER TABLE public.sync_events ALTER COLUMN client_uuid SET NOT NULL;
    END IF;
END $$;

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


-- 3. Atomic Sequence Allocation and Event Ingestion Function (Gapless, Idempotent per ADR-002)
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
    v_new_event      public.sync_events;
BEGIN
    IF p_client_uuid IS NULL THEN
        RAISE EXCEPTION 'client_uuid is required for sync events' USING ERRCODE = 'not_null_violation';
    END IF;

    -- 1. Idempotency fast-path: if client_uuid already recorded for this tenant, verify matching contents
    SELECT * INTO v_existing_event
    FROM public.sync_events
    WHERE tenant_id = p_tenant_id AND client_uuid = p_client_uuid;

    IF FOUND THEN
        -- Reject reused client_uuid if entity or payload differs
        IF v_existing_event.entity_type != p_entity_type 
           OR v_existing_event.entity_id != p_entity_id 
           OR v_existing_event.event_type != p_event_type 
           OR v_existing_event.payload != COALESCE(p_payload, '{}'::jsonb) THEN
            RAISE EXCEPTION 'Idempotency conflict: client_uuid "%" has already been used with different entity or payload', p_client_uuid
                USING ERRCODE = 'unique_violation';
        END IF;

        -- Exact match: return existing event WITHOUT incrementing sequence counter (ZERO GAPS on retries)
        RETURN v_existing_event;
    END IF;

    -- Ensure tenant counter row exists
    INSERT INTO public.tenant_sync_counters (tenant_id, last_sequence, updated_at)
    VALUES (p_tenant_id, 0, NOW())
    ON CONFLICT (tenant_id) DO NOTHING;

    -- 2. Acquire transaction advisory lock per tenant to serialize new event sequence assignment
    PERFORM pg_advisory_xact_lock(hashtext('sync_seq_' || p_tenant_id::text));

    -- Re-check under lock in case of concurrent insert with same client_uuid
    SELECT * INTO v_existing_event
    FROM public.sync_events
    WHERE tenant_id = p_tenant_id AND client_uuid = p_client_uuid;

    IF FOUND THEN
        IF v_existing_event.entity_type != p_entity_type 
           OR v_existing_event.entity_id != p_entity_id 
           OR v_existing_event.event_type != p_event_type 
           OR v_existing_event.payload != COALESCE(p_payload, '{}'::jsonb) THEN
            RAISE EXCEPTION 'Idempotency conflict: client_uuid "%" has already been used with different entity or payload', p_client_uuid
                USING ERRCODE = 'unique_violation';
        END IF;

        RETURN v_existing_event;
    END IF;

    -- Allocate next sequence strictly when inserting a new event
    WITH next_seq AS (
        UPDATE public.tenant_sync_counters
        SET last_sequence = last_sequence + 1,
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id
        RETURNING last_sequence
    )
    INSERT INTO public.sync_events (
        tenant_id,
        entity_type,
        entity_id,
        event_type,
        payload,
        client_uuid,
        sequence,
        created_at
    )
    SELECT
        p_tenant_id,
        p_entity_type,
        p_entity_id,
        p_event_type,
        COALESCE(p_payload, '{}'::jsonb),
        p_client_uuid,
        next_seq.last_sequence,
        NOW()
    FROM next_seq
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

-- 6. Enforce valid roles on public.users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT chk_users_role
        CHECK (role IN ('STUDENT', 'PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'ZONAL_OFFICER', 'MOE_OFFICER', 'SUPER_ADMIN'));
    END IF;
END $$;


-- 7. Student Cap Hardening: Row locking, harmless update skipping, and user reactivation trigger
CREATE OR REPLACE FUNCTION public.enforce_student_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan TEXT;
    v_active_count INTEGER;
BEGIN
    -- If updating and neither tenant_id nor user_id changed, skip check completely (allows harmless class/profile edits)
    IF TG_OP = 'UPDATE' THEN
        IF (NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id) AND (NEW.user_id IS NOT DISTINCT FROM OLD.user_id) THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Take transaction advisory lock to serialize cap checks per tenant without blocking key-share FK inserts
    PERFORM pg_advisory_xact_lock(hashtext('student_cap_' || NEW.tenant_id::text));

    -- Lock the tenant row FOR NO KEY UPDATE so foreign key key-share locks are not blocked
    SELECT plan INTO v_plan 
    FROM public.tenants 
    WHERE id = NEW.tenant_id 
    FOR NO KEY UPDATE;

    -- Enforce student cap for COMMUNITY (75 active students per blueprint §7b)
    IF v_plan = 'COMMUNITY' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.students s
        JOIN public.users u ON u.id = s.user_id
        WHERE s.tenant_id = NEW.tenant_id 
          AND u.is_active = TRUE 
          AND (TG_OP = 'INSERT' OR s.id != NEW.id);

        IF v_active_count >= 75 THEN
            RAISE EXCEPTION 'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.' 
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_cap_trigger ON public.students;
CREATE TRIGGER enforce_student_cap_trigger
    BEFORE INSERT OR UPDATE OF tenant_id, user_id ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_student_cap();

-- Trigger for user reactivation (users.is_active false -> true)
CREATE OR REPLACE FUNCTION public.enforce_user_reactivation_student_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan TEXT;
    v_active_count INTEGER;
BEGIN
    -- Only trigger when an inactive student user is being reactivated
    IF (OLD.is_active = FALSE AND NEW.is_active = TRUE AND NEW.role = 'STUDENT') THEN
        -- Take transaction advisory lock to serialize cap checks per tenant
        PERFORM pg_advisory_xact_lock(hashtext('student_cap_' || NEW.tenant_id::text));

        -- Lock the tenant row FOR NO KEY UPDATE so foreign key key-share locks are not blocked
        SELECT plan INTO v_plan 
        FROM public.tenants 
        WHERE id = NEW.tenant_id 
        FOR NO KEY UPDATE;

        IF v_plan = 'COMMUNITY' THEN
            SELECT count(*) INTO v_active_count 
            FROM public.students s
            JOIN public.users u ON u.id = s.user_id
            WHERE s.tenant_id = NEW.tenant_id 
              AND u.is_active = TRUE;

            IF v_active_count >= 75 THEN
                RAISE EXCEPTION 'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.' 
                    USING ERRCODE = 'check_violation';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_reactivation_student_cap ON public.users;
CREATE TRIGGER trg_user_reactivation_student_cap
    BEFORE UPDATE OF is_active ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_user_reactivation_student_cap();


-- 8. Tenant Storage Ledgers & Totals View (ADR-001 Storage Quota and Renditions Tracking)
CREATE TABLE IF NOT EXISTS public.tenant_storage_ledgers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    resource_id     TEXT NOT NULL,
    resource_type   TEXT NOT NULL, -- e.g. 'video_master', 'video_rendition_360p', 'attachment'
    bytes           BIGINT NOT NULL DEFAULT 0,
    format          TEXT,
    idempotency_key TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_storage_ledger_idemp UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_storage_ledgers_tenant ON public.tenant_storage_ledgers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_storage_ledgers_resource ON public.tenant_storage_ledgers (tenant_id, resource_id);

ALTER TABLE public.tenant_storage_ledgers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_storage_ledgers FROM anon, authenticated;
GRANT ALL ON public.tenant_storage_ledgers TO service_role;

-- Tenant Storage Totals View (Blueprint Quota Enforcement)
CREATE OR REPLACE VIEW public.tenant_storage_usage AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.plan,
    COALESCE(p.storage_quota_gb, 2) AS storage_quota_gb,
    COALESCE(SUM(l.bytes), 0) AS total_bytes_used,
    ROUND(COALESCE(SUM(l.bytes), 0) / (1024.0 * 1024.0 * 1024.0), 3) AS total_gb_used,
    CASE 
        WHEN COALESCE(SUM(l.bytes), 0) >= (COALESCE(p.storage_quota_gb, 2)::numeric * 1024.0 * 1024.0 * 1024.0) THEN true 
        ELSE false 
    END AS is_quota_exceeded
FROM public.tenants t
LEFT JOIN public.plans p ON p.code = t.plan
LEFT JOIN public.tenant_storage_ledgers l ON l.tenant_id = t.id
GROUP BY t.id, t.name, t.plan, p.storage_quota_gb;

ALTER VIEW public.tenant_storage_usage SET (security_invoker = true);
REVOKE ALL ON public.tenant_storage_usage FROM anon, authenticated;
GRANT ALL ON public.tenant_storage_usage TO service_role;


-- 9. Attendance Conflicts Log (ADR-002 Offline Sync Conflict Audit)
CREATE TABLE IF NOT EXISTS public.attendance_conflicts_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id        UUID,
    student_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conflict_date   DATE NOT NULL,
    client_state    JSONB NOT NULL DEFAULT '{}'::jsonb,
    server_state    JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolution      TEXT NOT NULL CHECK (resolution IN ('SERVER_WINS', 'CLIENT_WINS', 'MANUAL_MERGE')),
    resolved_by     UUID REFERENCES public.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_conflicts_tenant ON public.attendance_conflicts_log (tenant_id, conflict_date);

ALTER TABLE public.attendance_conflicts_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_conflicts_log FROM anon, authenticated;
GRANT ALL ON public.attendance_conflicts_log TO service_role;


-- 10. GDPR/Privacy PII Scrubber for Sync Events
CREATE OR REPLACE FUNCTION public.scrub_user_sync_events_pii(
    p_tenant_id UUID,
    p_user_id   UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.sync_events
    SET payload = jsonb_strip_nulls(
        payload - 'full_name' - 'name' - 'email' - 'phone' - 'national_id' || 
        jsonb_build_object('anonymized', true, 'scrubbed_at', NOW())
    )
    WHERE tenant_id = p_tenant_id
      AND (entity_id = p_user_id OR payload->>'student_id' = p_user_id::text OR payload->>'sender_id' = p_user_id::text);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.scrub_user_sync_events_pii FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_user_sync_events_pii TO service_role;


-- 11. 90-Day Retention Purge Job for Sync Events (ADR-002)
CREATE OR REPLACE FUNCTION public.purge_old_sync_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.sync_events
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_sync_events FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_sync_events TO service_role;


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

