-- =============================================================================
-- Migration: 20261007000000_phase3_sync_events_and_push.sql
-- Description:
-- Phase 3 Sprint 0 Foundation:
-- 1. Create public.sync_events table for Event-Sourced Push Sync Engine.
-- 2. Create public.device_tokens table for FCM Silent Push and Alerts.
-- 3. Configure Row-Level Security (RLS) policies for tenant isolation.
-- =============================================================================

-- 1. Sync Events Table (Event-Sourced Push Stream)
CREATE TABLE IF NOT EXISTS public.sync_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL,                                              -- 'attendance', 'homework_submission', 'chat_message'
    entity_id       TEXT NOT NULL,                                              -- Entity PK (compatible with UUID and text-based IDs)
    event_type      TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'DELETED')),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_uuid     TEXT UNIQUE,                                                -- Client idempotency key (UUIDv4)
    sequence        BIGINT GENERATED ALWAYS AS IDENTITY,                       -- Server-authoritative monotonic sequence
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_events_tenant_seq ON public.sync_events (tenant_id, sequence);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON public.sync_events (tenant_id, entity_type, sequence);

ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_sync_events" ON public.sync_events
    FOR ALL
    USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true))
    WITH CHECK (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));

CREATE POLICY "service_role_all_sync_events" ON public.sync_events
    FOR ALL
    USING (true)
    WITH CHECK (true);


-- 2. Device Tokens Table (FCM Push Registry)
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

CREATE POLICY "tenant_device_tokens" ON public.device_tokens
    FOR ALL
    USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true))
    WITH CHECK (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));

CREATE POLICY "service_role_all_device_tokens" ON public.device_tokens
    FOR ALL
    USING (true)
    WITH CHECK (true);
