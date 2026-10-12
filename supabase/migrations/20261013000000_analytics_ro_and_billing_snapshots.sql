-- =============================================================================
-- Migration: 20261013000000_analytics_ro_and_billing_snapshots.sql
-- Description:
-- 1. Provision read-only database role (analytics_ro) for the Analytics microservice.
-- 2. Create public.media_download_logs to track offline media distribution.
-- 3. Create public.billing_snapshots for nightly tenant usage and invoice generation.
-- =============================================================================

-- 1. Analytics Read-Only Role
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_ro') THEN
        CREATE ROLE analytics_ro WITH LOGIN PASSWORD 'analytics_ro_secret_dev';
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO analytics_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics_ro;

-- 2. Media Download Logs Table (P3-S6, P3-S9)
CREATE TABLE IF NOT EXISTS public.media_download_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    asset_id        UUID NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    downloaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_download_logs_tenant ON public.media_download_logs (tenant_id, downloaded_at);
CREATE INDEX IF NOT EXISTS idx_media_download_logs_asset ON public.media_download_logs (asset_id);

ALTER TABLE public.media_download_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_download_logs FROM anon, authenticated;
GRANT ALL ON public.media_download_logs TO service_role;
GRANT SELECT ON public.media_download_logs TO analytics_ro;

-- 3. Billing Snapshots Table (P3-S9)
CREATE TABLE IF NOT EXISTS public.billing_snapshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    billing_month           TEXT NOT NULL, -- e.g. '2026-10'
    plan                    TEXT NOT NULL,
    active_student_count    INTEGER NOT NULL DEFAULT 0,
    base_fee_lkr            INTEGER NOT NULL DEFAULT 0,
    per_student_fee_lkr     INTEGER NOT NULL DEFAULT 0,
    sms_count               INTEGER NOT NULL DEFAULT 0,
    sms_overage_charge_lkr  INTEGER NOT NULL DEFAULT 0,
    total_amount_lkr        INTEGER NOT NULL DEFAULT 0,
    status                  TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_billing_snapshot_tenant_month UNIQUE (tenant_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_billing_snapshots_month ON public.billing_snapshots (billing_month);

ALTER TABLE public.billing_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billing_snapshots FROM anon, authenticated;
GRANT ALL ON public.billing_snapshots TO service_role;
GRANT SELECT ON public.billing_snapshots TO analytics_ro;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
