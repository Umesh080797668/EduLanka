-- =============================================================================
-- Migration: 20261007000000_phase3_sync_events_and_push.sql
-- Description:
-- Phase 3 Sprint 0 Foundation:
-- 1. Create public.tenant_sync_counters for monotonic per-tenant sequence assignment.
-- 2. Create public.sync_events table for Event-Sourced Push Sync Engine.
--    - Uses UUID for entity_id.
--    - Enforces UNIQUE (tenant_id, client_uuid) per-tenant idempotency.
-- 3. Create public.device_tokens table for FCM Push Registry.
--    - Token ownership re-assignment on re-registration.
-- 4. Secure RLS policies:
--    - NO permissive service_role policies (prevents PUBLIC role leak).
--    - Explicit REVOKE from anon/authenticated where appropriate.
-- =============================================================================

-- 1. Per-Tenant Monotonic Sync Sequence Counter
CREATE TABLE IF NOT EXISTS public.tenant_sync_counters (
    tenant_id       UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    last_sequence   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tenant_sync_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_sync_counters FROM anon, authenticated;
GRANT ALL ON public.tenant_sync_counters TO service_role;


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
    UNIQUE (tenant_id, client_uuid)
);

CREATE INDEX IF NOT EXISTS idx_sync_events_tenant_seq ON public.sync_events (tenant_id, sequence);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON public.sync_events (tenant_id, entity_type, sequence);

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


-- 3. Device Tokens Table (FCM Push Registry)
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

-- Completely revoke direct client-facing access from anon and authenticated.
-- Device registration must route through the Nest API (reassigning token ownership securely).
REVOKE ALL ON public.device_tokens FROM anon, authenticated;
GRANT ALL ON public.device_tokens TO service_role;
