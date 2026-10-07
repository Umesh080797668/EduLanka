-- =============================================================================
-- Migration: 20261005000000_fix_student_cap_and_grades.sql
-- Description:
-- 1. Drop old free tier student capacity trigger and function (restrict_free_tier_student_cap / enforce_student_capacity).
-- 2. Update enforce_student_cap to 75 active students for COMMUNITY tier per blueprint §7b.
-- 3. Add SET search_path = public, pg_temp to enforce_student_cap() for SECURITY DEFINER safety.
-- =============================================================================

-- Drop deprecated trigger and function from 20260819130000_student_cap_trigger_sprint7.sql
DROP TRIGGER IF EXISTS restrict_free_tier_student_cap ON public.students;
DROP FUNCTION IF EXISTS public.enforce_student_capacity();

-- Update enforce_student_cap with search_path and 75 student cap (COMMUNITY tier, blueprint §7b)
CREATE OR REPLACE FUNCTION public.enforce_student_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_plan TEXT;
    v_active_count INTEGER;
BEGIN
    -- Fetch tenant's plan
    SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;

    -- Enforce student cap for COMMUNITY (75 active students per blueprint §7b)
    IF v_plan = 'COMMUNITY' THEN
        SELECT count(*) INTO v_active_count 
        FROM public.students s
        JOIN public.users u ON u.id = s.user_id
        WHERE s.tenant_id = NEW.tenant_id AND u.is_active = TRUE AND s.id != NEW.id;

        IF v_active_count >= 75 THEN
            RAISE EXCEPTION 'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.' USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_cap_trigger ON public.students;
CREATE TRIGGER enforce_student_cap_trigger
    BEFORE INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_student_cap();

-- 4. Backfill grades 1-13 for any existing tenant that has none
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        IF NOT EXISTS (SELECT 1 FROM public.grades_config WHERE tenant_id = t.id) THEN
            INSERT INTO public.grades_config (tenant_id, level, label)
            VALUES 
                (t.id, 1, 'Grade 1'),
                (t.id, 2, 'Grade 2'),
                (t.id, 3, 'Grade 3'),
                (t.id, 4, 'Grade 4'),
                (t.id, 5, 'Grade 5'),
                (t.id, 6, 'Grade 6'),
                (t.id, 7, 'Grade 7'),
                (t.id, 8, 'Grade 8'),
                (t.id, 9, 'Grade 9'),
                (t.id, 10, 'Grade 10'),
                (t.id, 11, 'Grade 11'),
                (t.id, 12, 'Grade 12'),
                (t.id, 13, 'Grade 13')
            ON CONFLICT (tenant_id, level) DO NOTHING;
        END IF;
    END LOOP;
END;
$$;

-- 5. Backfill missing school_policy rows for any tenant that lacks one
INSERT INTO public.school_policy (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
