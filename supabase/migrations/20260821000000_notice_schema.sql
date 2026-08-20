-- =============================================================================
-- Migration: 20260821000000_notice_schema.sql
-- Description: Core Notice System schema and RLS
-- =============================================================================

CREATE TABLE public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_html TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('UNIVERSAL', 'SCHOOL_WIDE', 'GRADE_LEVEL', 'CLASS_SPECIFIC')),
    target_group_id UUID, -- For Class ID or Grade ID
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    attachments JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notice_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(notice_id, user_id)
);

-- =============================================================================
-- RLS & Policies
-- =============================================================================

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_notices_policy" ON public.notices
    FOR ALL
    USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));

CREATE POLICY "tenant_notice_reads_policy" ON public.notice_reads
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.notices n 
            WHERE n.id = notice_reads.notice_id 
            AND n.tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true)
        )
    );

-- Service Role Bypass
CREATE POLICY "service_role_notices" ON public.notices USING (true) WITH CHECK (true);
CREATE POLICY "service_role_notice_reads" ON public.notice_reads USING (true) WITH CHECK (true);

-- Updated At Trigger
CREATE TRIGGER notices_updated_at BEFORE UPDATE ON public.notices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
