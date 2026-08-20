-- =============================================================================
-- Migration: 20260822000001_sms_logs.sql
-- Description: Tracking transactional Twilio events natively across the unified DB.
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE public.sms_status AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    notice_id UUID REFERENCES public.notices(id) ON DELETE SET NULL,
    twilio_sid TEXT UNIQUE,
    recipient_number TEXT NOT NULL,
    status public.sms_status NOT NULL DEFAULT 'QUEUED',
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_tenant ON public.sms_logs(tenant_id);
CREATE INDEX idx_sms_logs_sid ON public.sms_logs(twilio_sid) WHERE twilio_sid IS NOT NULL;

-- Create the generic updated_at function
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Automatically update timestamps
CREATE TRIGGER update_sms_logs_updated_at
BEFORE UPDATE ON public.sms_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- RLS Setup
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admins_all_sms" 
ON public.sms_logs 
AS PERMISSIVE 
FOR ALL 
TO authenticated 
USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "tenant_read_sms" 
ON public.sms_logs 
AS PERMISSIVE 
FOR SELECT 
TO authenticated 
USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));

-- =============================================================================
-- VIEW: monthly_sms_usage
-- Pre-calculating billing aggregates based on sent messages per month.
-- =============================================================================

CREATE OR REPLACE VIEW public.monthly_sms_usage AS
SELECT 
    tenant_id,
    DATE_TRUNC('month', created_at) AS billing_month,
    COUNT(id) as total_dispatched,
    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as total_failed,
    SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as total_delivered
FROM public.sms_logs
GROUP BY tenant_id, DATE_TRUNC('month', created_at);
