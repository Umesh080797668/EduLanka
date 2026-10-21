-- =============================================================================
-- Migration: 20261021000001_fix_real_database_gaps.sql
-- Description:
-- 1. Adds generated `name` column to public.classes ('Grade ' || grade || '-' || section)
--    so classes(id, name, grade) embeds work across all endpoints.
-- 2. Creates public.v_active_students_per_tenant view and
--    public.get_active_student_counts_per_tenant() RPC for nightly billing
--    to count active students per tenant accurately without hitting PostgREST's 1000-row limit.
-- 3. Creates public.parent_students compatibility view mapping to public.parents.
-- 4. Recreates public.get_global_tutorial_stats() RPC in shared schema for System Admin dashboard.
-- =============================================================================

-- 1. Add generated `name` column to public.classes
ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS name TEXT GENERATED ALWAYS AS ('Grade ' || grade::TEXT || '-' || section) STORED;

CREATE INDEX IF NOT EXISTS idx_classes_name ON public.classes(tenant_id, name);

-- 2. Active students per tenant aggregation view & RPC (Nightly Billing)
CREATE OR REPLACE VIEW public.v_active_students_per_tenant AS
SELECT s.tenant_id, COUNT(*)::BIGINT AS active_student_count
FROM public.students s
JOIN public.users u ON u.id = s.user_id
WHERE u.is_active = TRUE
GROUP BY s.tenant_id;

GRANT SELECT ON public.v_active_students_per_tenant TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.get_active_student_counts_per_tenant()
RETURNS TABLE (
    tenant_id UUID,
    active_student_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT s.tenant_id, COUNT(*)::BIGINT AS active_student_count
    FROM public.students s
    JOIN public.users u ON u.id = s.user_id
    WHERE u.is_active = TRUE
    GROUP BY s.tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_student_counts_per_tenant() TO service_role, authenticated;

-- 3. Parent-students compatibility view
CREATE OR REPLACE VIEW public.parent_students AS
SELECT 
    p.id,
    p.tenant_id,
    p.user_id AS parent_id,
    p.student_id,
    p.relationship,
    p.created_at
FROM public.parents p;

GRANT SELECT ON public.parent_students TO service_role, authenticated;

-- 4. Global tutorial stats RPC for System Admin
CREATE OR REPLACE FUNCTION public.get_global_tutorial_stats()
RETURNS TABLE (
    tutorial_id UUID,
    role TEXT,
    screen_id TEXT,
    completed BIGINT,
    skipped BIGINT,
    eligible BIGINT,
    completion_percentage INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH completions AS (
        SELECT 
            ut.tutorial_id,
            COUNT(*) FILTER (WHERE ut.status = 'COMPLETED') AS completed_count,
            COUNT(*) FILTER (WHERE ut.status = 'SKIPPED') AS skipped_count
        FROM public.user_tutorials ut
        GROUP BY ut.tutorial_id
    ),
    eligible_users AS (
        SELECT 
            u.role,
            COUNT(*) AS user_count
        FROM public.users u
        WHERE u.is_active = TRUE
        GROUP BY u.role
    )
    SELECT 
        t.id AS tutorial_id,
        t.role::TEXT AS role,
        t.screen_id::TEXT AS screen_id,
        COALESCE(c.completed_count, 0)::BIGINT AS completed,
        COALESCE(c.skipped_count, 0)::BIGINT AS skipped,
        COALESCE(eu.user_count, 0)::BIGINT AS eligible,
        CASE 
            WHEN COALESCE(eu.user_count, 0) > 0 THEN 
                ROUND((COALESCE(c.completed_count, 0)::NUMERIC / eu.user_count::NUMERIC) * 100)::INT
            ELSE 0
        END AS completion_percentage
    FROM public.tutorials t
    LEFT JOIN completions c ON c.tutorial_id = t.id
    LEFT JOIN eligible_users eu ON eu.role = t.role
    ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_tutorial_stats() TO service_role, authenticated;
