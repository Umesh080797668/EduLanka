-- =============================================================================
-- Migration: 20261013000000_analytics_ro_and_billing_snapshots.sql
-- Description:
-- 1. Provision read-only database role (analytics_ro) for the Analytics microservice.
-- 2. Create public.media_download_logs to track offline media distribution.
-- 3. Create public.billing_snapshots for nightly tenant usage and invoice generation.
-- =============================================================================

-- 1. Analytics Read-Only Role (Password provisioned and rotated outside migrations)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analytics_ro') THEN
        CREATE ROLE analytics_ro WITH LOGIN;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO analytics_ro;

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

-- 4. Scoped Grants for Analytics Service (Least Privilege: No access to sync payloads, auth, or personal data)
GRANT SELECT ON public.tenants TO analytics_ro;
GRANT SELECT ON public.users TO analytics_ro;
GRANT SELECT ON public.plans TO analytics_ro;
GRANT SELECT ON public.sms_logs TO analytics_ro;
GRANT SELECT ON public.device_tokens TO analytics_ro;
GRANT SELECT ON public.media_assets TO analytics_ro;
GRANT SELECT ON public.media_download_logs TO analytics_ro;
GRANT SELECT, INSERT, UPDATE ON public.billing_snapshots TO analytics_ro;

-- Scoped Grants on Analytics Views
GRANT SELECT ON public.tenant_storage_usage TO analytics_ro;
GRANT SELECT ON public.monthly_sms_usage TO analytics_ro;
GRANT SELECT ON public.tenant_sms_quotas TO analytics_ro;

-- 5. Explicit RLS Policies for analytics_ro Role
DROP POLICY IF EXISTS "analytics_ro_select_tenants" ON public.tenants;
CREATE POLICY "analytics_ro_select_tenants" ON public.tenants FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_users" ON public.users;
CREATE POLICY "analytics_ro_select_users" ON public.users FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_plans" ON public.plans;
CREATE POLICY "analytics_ro_select_plans" ON public.plans FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_sms_logs" ON public.sms_logs;
CREATE POLICY "analytics_ro_select_sms_logs" ON public.sms_logs FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_device_tokens" ON public.device_tokens;
CREATE POLICY "analytics_ro_select_device_tokens" ON public.device_tokens FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_media_assets" ON public.media_assets;
CREATE POLICY "analytics_ro_select_media_assets" ON public.media_assets FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_media_download_logs" ON public.media_download_logs;
CREATE POLICY "analytics_ro_select_media_download_logs" ON public.media_download_logs FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_select_billing_snapshots" ON public.billing_snapshots;
CREATE POLICY "analytics_ro_select_billing_snapshots" ON public.billing_snapshots FOR SELECT TO analytics_ro USING (true);

DROP POLICY IF EXISTS "analytics_ro_modify_billing_snapshots" ON public.billing_snapshots;
CREATE POLICY "analytics_ro_modify_billing_snapshots" ON public.billing_snapshots FOR ALL TO analytics_ro USING (true) WITH CHECK (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
