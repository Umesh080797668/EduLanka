-- =============================================================================
-- EduLanka — Migration 009: Sprint 7 School Policy (Unified RLS Fix)
-- =============================================================================
-- Re-create the school_policy table in the public schema with unified RLS using tenant_id

CREATE TABLE IF NOT EXISTS public.school_policy (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    academic_year           SMALLINT    NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::SMALLINT,
    max_students_per_class  SMALLINT    NOT NULL DEFAULT 40,
    allow_self_enrollment   BOOLEAN     NOT NULL DEFAULT FALSE,
    sms_enabled             BOOLEAN     NOT NULL DEFAULT FALSE,
    default_language        TEXT        NOT NULL DEFAULT 'en',
    timezone                TEXT        NOT NULL DEFAULT 'Asia/Colombo',
    school_hours_start      TIME        NOT NULL DEFAULT '07:30:00',
    school_hours_end        TIME        NOT NULL DEFAULT '14:00:00',
    extra_config            JSONB       NOT NULL DEFAULT '{}'::JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

ALTER TABLE public.school_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_school_policy" ON public.school_policy USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.school_policy USING (true) WITH CHECK (true);

CREATE TRIGGER school_policy_updated_at BEFORE UPDATE ON public.school_policy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed policies for existing tenants automatically
INSERT INTO public.school_policy (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
