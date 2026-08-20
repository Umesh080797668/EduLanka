-- =============================================================================
-- Migration: 20260821000002_plan_constraints.sql
-- Description: Platform Tier limits enforcement mapped to the collapse (Blueprint §7)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_student_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan TEXT;
    v_active_count INTEGER;
BEGIN
    -- Only check active students
    IF NEW.is_active = FALSE THEN
        RETURN NEW;
    END IF;

    -- Fetch tenant's plan
    SELECT plan INTO v_plan FROM public.tenants WHERE id = NEW.tenant_id;

    -- Only enforce hardware cap for COMMUNITY
    IF v_plan = 'COMMUNITY' THEN
        -- We add 1 for the new row being inserted if it is an insert, 
        -- but counting existing gives us the bounds precisely before commit.
        SELECT count(*) INTO v_active_count 
        FROM public.students 
        WHERE tenant_id = NEW.tenant_id AND is_active = TRUE AND id != NEW.id;

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
