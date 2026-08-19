-- Migration 014: System Audit Trails

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id        TEXT        NOT NULL, -- could be a UUID or 'SYSTEM'
    actor_role      TEXT        NOT NULL,
    action          TEXT        NOT NULL, -- e.g. 'TENANT_PROVISIONED', 'USER_ROLE_CHANGED'
    entity_type     TEXT        NOT NULL, -- e.g. 'TENANT', 'USER'
    entity_id       TEXT        NOT NULL,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_audit_logs" ON public.audit_logs 
    USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.audit_logs 
    USING (true) WITH CHECK (true);

-- No triggers needed, the API explicitly performs logging to attach request context (IP, User)
