-- =============================================================================
-- EduLanka — Migration 010: Deactivation Reasons and Inquiries
-- =============================================================================

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

CREATE TABLE IF NOT EXISTS public.deactivation_inquiries (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        REFERENCES public.users(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL,
    message         TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.deactivation_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_inquiries" ON public.deactivation_inquiries 
    FOR SELECT 
    USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all_inq" ON public.deactivation_inquiries 
    USING (true) WITH CHECK (true);
