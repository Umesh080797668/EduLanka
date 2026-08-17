-- =============================================================================
-- EduLanka — Migration 013: Seed Curriculum Grades config
-- =============================================================================
-- This migration seeds default school grades for all active tenants

DO $$ 
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
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
    END LOOP;
END;
$$;
