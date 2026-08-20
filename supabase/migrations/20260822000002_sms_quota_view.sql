-- =============================================================================
-- Migration: 20260822000002_sms_quota_view.sql
-- Description: View mapping live monthly usages against static Tier quotas.
-- Calculates overages directly at the database level for billing.
-- =============================================================================

CREATE OR REPLACE VIEW public.tenant_sms_quotas AS
SELECT 
    t.id AS tenant_id,
    t.name as tenant_name,
    t.plan,
    CASE 
        WHEN t.plan = 'COMMUNITY' THEN 0
        WHEN t.plan = 'STARTER' THEN 500
        WHEN t.plan = 'GROWTH' THEN 2000
        WHEN t.plan = 'INSTITUTIONAL' THEN 10000
        ELSE 0 
    END as monthly_quota,
    COALESCE(u.total_dispatched, 0) as current_month_usage,
    COALESCE(u.total_delivered, 0) as successful_deliveries,
    COALESCE(u.total_failed, 0) as failed_deliveries,
    CASE 
        WHEN t.plan IN ('COMMUNITY') THEN COALESCE(u.total_dispatched, 0)
        WHEN COALESCE(u.total_dispatched, 0) > (
            CASE 
                WHEN t.plan = 'STARTER' THEN 500
                WHEN t.plan = 'GROWTH' THEN 2000
                WHEN t.plan = 'INSTITUTIONAL' THEN 10000
                ELSE 0 END
        ) THEN COALESCE(u.total_dispatched, 0) - (
            CASE 
                WHEN t.plan = 'STARTER' THEN 500
                WHEN t.plan = 'GROWTH' THEN 2000
                WHEN t.plan = 'INSTITUTIONAL' THEN 10000
                ELSE 0 END
        )
        ELSE 0
    END as overage_count
FROM public.tenants t
LEFT JOIN public.monthly_sms_usage u 
    ON t.id = u.tenant_id 
    AND u.billing_month = DATE_TRUNC('month', NOW());
