-- =============================================================================
-- Migration: 20260808000006_tutorials.sql
-- Description: Implement central tutorial-content store and per-user completion tracking.
-- =============================================================================

-- =============================================================================
-- 1. Create global tutorial config tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,         -- e.g., 'STUDENT', 'TEACHER', 'PARENT', 'SCHOOL_ADMIN'
    screen_id TEXT NOT NULL,    -- e.g., 'dashboard', 'grades'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role, screen_id)
);

CREATE TABLE IF NOT EXISTS public.tutorial_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutorial_id UUID NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    target_element TEXT,        -- CSS selector, nullable for centered modals
    title_en TEXT NOT NULL,
    title_si TEXT,
    title_ta TEXT,
    content_en TEXT NOT NULL,
    content_si TEXT,
    content_ta TEXT,
    media_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tutorial_id, step_order)
);

-- RLS & Policies
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_steps ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (of any role) to READ active tutorials
CREATE POLICY "auth_read_tutorials" ON public.tutorials
    FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

CREATE POLICY "auth_read_tutorial_steps" ON public.tutorial_steps
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role bypass
CREATE POLICY "service_all_tutorials" ON public.tutorials USING (true) WITH CHECK (true);
CREATE POLICY "service_all_steps" ON public.tutorial_steps USING (true) WITH CHECK (true);

-- Updated At triggers
CREATE TRIGGER tutorials_updated_at BEFORE UPDATE ON public.tutorials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. Apply script: add user_tutorials to a tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_sprint6_to_tenant(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schema TEXT;
BEGIN
    v_schema := 'tenant_' || p_slug;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = v_schema AND table_name = 'user_tutorials'
    ) THEN
        EXECUTE format('
            CREATE TABLE %I.user_tutorials (
                id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id         UUID        NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
                tutorial_id     UUID        NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
                status          TEXT        NOT NULL CHECK (status IN (''COMPLETED'', ''SKIPPED'')),
                completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, tutorial_id)
            )', v_schema, v_schema);

        EXECUTE format('ALTER TABLE %I.user_tutorials ENABLE ROW LEVEL SECURITY', v_schema);
        EXECUTE format('CREATE POLICY "service_role_all" ON %I.user_tutorials USING (true) WITH CHECK (true)', v_schema);
        
        -- Users can only read their own tracking
        EXECUTE format('
            CREATE POLICY "user_read_own_tutorials" ON %I.user_tutorials
            FOR SELECT USING (
                user_id IN (SELECT id FROM %I.users WHERE auth_uid = auth.uid())
            )', v_schema, v_schema);
            
        -- School Admins can read aggregate completions
        EXECUTE format('
            CREATE POLICY "admin_read_all_tutorials" ON %I.user_tutorials
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM %I.users u
                    WHERE u.auth_uid = auth.uid() AND u.role = ''SCHOOL_ADMIN''
                )
            )', v_schema, v_schema);

        EXECUTE format('CREATE INDEX idx_user_tutorials_user_id ON %I.user_tutorials(user_id)', v_schema);
        EXECUTE format('CREATE INDEX idx_user_tutorials_tutorial_id ON %I.user_tutorials(tutorial_id)', v_schema);
    END IF;

    RAISE NOTICE 'Sprint 6 schema (user tutorials) applied to tenant %', p_slug;
END;
$$;

-- Apply to all existing tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants WHERE status = 'ACTIVE'
    LOOP
        PERFORM public.apply_sprint6_to_tenant(t.slug);
    END LOOP;
END;
$$;

-- =============================================================================
-- 3. Modify create_tenant_schema directly to include Sprint 6
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema_sprint6_override(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Run core setup + Sprint 4
    PERFORM public.create_tenant_schema_sprint4_override(p_slug);
    
    -- 2. Run new sprint 6 migrations for the schema
    PERFORM public.apply_sprint6_to_tenant(p_slug);
END;
$$;

-- Seed Basic Tutorials (Admin / Student / Teacher / Parent)
INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'STUDENT', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000002', 'TEACHER', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000003', 'SCHOOL_ADMIN', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000004', 'PARENT', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000005', 'STUDENT', 'grades'),
    ('a0000000-0000-0000-0000-000000000006', 'TEACHER', 'grades'),
    ('a0000000-0000-0000-0000-000000000007', 'PARENT', 'grades'),
    ('a0000000-0000-0000-0000-000000000008', 'SCHOOL_ADMIN', 'users'),
    ('a0000000-0000-0000-0000-000000000009', 'SCHOOL_ADMIN', 'policy')
ON CONFLICT DO NOTHING;

INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, content_en)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 1, '#nav-grades', 'My Grades', 'Click here to view your report cards and specific subject marks.'),
    ('a0000000-0000-0000-0000-000000000001', 2, '#nav-dashboard', 'Dashboard overview', 'This is your dashboard which summarizes your latest activities.'),
    
    ('a0000000-0000-0000-0000-000000000002', 1, '#nav-classes', 'Your Classes', 'Manage your assigned classes and record attendance here.'),
    ('a0000000-0000-0000-0000-000000000002', 2, '#nav-gradebook', 'Enter Marks', 'Use the Gradebook to quickly record student marks per term.'),

    ('a0000000-0000-0000-0000-000000000003', 1, '#nav-users', 'Manage Accounts', 'From here, you can enroll students, unenroll via transfer, and manage teacher accounts.'),
    ('a0000000-0000-0000-0000-000000000003', 2, '#nav-policies', 'Policies', 'Configure school-wide policies and feature limits.'),

    ('a0000000-0000-0000-0000-000000000004', 1, '#nav-dashboard', 'Welcome Parent', 'Track your child''s progress from this main dashboard.'),
    ('a0000000-0000-0000-0000-000000000005', 1, NULL, 'Report Card View', 'Review your official marks across terms, and download a PDF copy.'),
    ('a0000000-0000-0000-0000-000000000006', 1, NULL, 'Grade Entry System', 'Use this table to enter marks per student for the selected class.'),
    ('a0000000-0000-0000-0000-000000000007', 1, NULL, 'Student Report Card', 'View detailed academic performance and term grades for your child.'),
    ('a0000000-0000-0000-0000-000000000008', 1, NULL, 'Account Management', 'Enroll or disable users within your institution.'),
    ('a0000000-0000-0000-0000-000000000009', 1, NULL, 'Policy Settings', 'Adjust global settings, grading intervals, and school calendars.')
ON CONFLICT DO NOTHING;
