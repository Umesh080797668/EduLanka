-- Migration 012: Enforce FREE tier student capacity on Unified Schema

CREATE OR REPLACE FUNCTION public.enforce_student_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    t_plan public.tenant_plan;
    current_student_count INT;
BEGIN
    SELECT plan INTO t_plan FROM public.tenants WHERE id = NEW.tenant_id;
    
    IF t_plan = 'PRO' THEN
        RETURN NEW;
    END IF;
    
    IF t_plan = 'FREE' THEN
        SELECT COUNT(*) INTO current_student_count FROM public.students WHERE tenant_id = NEW.tenant_id;
        IF current_student_count >= 75 THEN
            RAISE EXCEPTION 'CapacityLimitViolated: Free tier tenants are limited to 75 students.'
                USING HINT = 'Upgrade to PRO to register more students.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_free_tier_student_cap ON public.students;

CREATE TRIGGER restrict_free_tier_student_cap
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.enforce_student_capacity();
