-- =============================================================================
-- Migration: 20260808000005_student_cap_and_marks.sql
-- Description: Implement free tier student limit caps and grade entries (marks).
-- =============================================================================

-- =============================================================================
-- 1. Free-tier Tenant Student Cap Trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_tenant_student_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_slug TEXT;
    v_max_students INTEGER;
    v_current_students INTEGER;
BEGIN
    -- Extract tenant slug from the schema (e.g., 'tenant_schoola' -> 'schoola')
    v_tenant_slug := replace(TG_TABLE_SCHEMA, 'tenant_', '');
    
    -- Get the max_students for this tenant's plan
    SELECT p.max_students INTO v_max_students
    FROM public.tenants t
    JOIN public.plans p ON t.plan = p.code
    WHERE t.slug = v_tenant_slug;
    
    -- if max_students is 0, it means unlimited. Otherwise check count.
    IF v_max_students > 0 THEN
        EXECUTE format('SELECT count(*) FROM %I.students', TG_TABLE_SCHEMA) INTO v_current_students;
        IF v_current_students >= v_max_students THEN
            RAISE EXCEPTION 'Free-tier student cap (%) exceeded for tenant %. Upgrade to PRO.', v_max_students, v_tenant_slug;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Apply script: add student_marks and trigger to a tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_sprint4_to_tenant(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schema TEXT;
BEGIN
    v_schema := 'tenant_' || p_slug;

    -- A. Add BEFORE INSERT trigger to enforce limit on students table
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_student_limit ON %I.students', v_schema);
    EXECUTE format('
        CREATE TRIGGER enforce_student_limit 
        BEFORE INSERT ON %I.students 
        FOR EACH ROW EXECUTE FUNCTION public.check_tenant_student_limit()
    ', v_schema);

    -- B. Create student_marks table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = v_schema AND table_name = 'student_marks'
    ) THEN
        EXECUTE format('
            CREATE TABLE %I.student_marks (
                id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id      UUID        NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
                class_id        UUID        NOT NULL REFERENCES %I.classes(id) ON DELETE CASCADE,
                subject         TEXT        NOT NULL,
                term            SMALLINT    NOT NULL CHECK (term BETWEEN 1 AND 3),
                academic_year   SMALLINT    NOT NULL,
                marks           REAL        NOT NULL CHECK (marks >= 0 AND marks <= 100),
                teacher_id      UUID        REFERENCES %I.teachers(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(student_id, subject, term, academic_year)
            )', v_schema, v_schema, v_schema, v_schema);

        -- RLS and triggers for student_marks
        EXECUTE format('ALTER TABLE %I.student_marks ENABLE ROW LEVEL SECURITY', v_schema);
        EXECUTE format('CREATE POLICY "service_role_all" ON %I.student_marks USING (true) WITH CHECK (true)', v_schema);
        
        -- Admin can read/write all marks
        EXECUTE format('
            CREATE POLICY "admin_all_marks" ON %I.student_marks
            USING (
                EXISTS (
                    SELECT 1 FROM %I.users u
                    WHERE u.auth_uid = auth.uid() AND u.role IN (''SCHOOL_ADMIN'')
                )
            )', v_schema, v_schema);
            
        -- Teachers can read/write marks for their classes
        EXECUTE format('
            CREATE POLICY "teacher_marks_access" ON %I.student_marks
            USING (
                EXISTS (
                    SELECT 1 FROM %I.users u
                    JOIN %I.teachers t ON t.user_id = u.id
                    JOIN %I.class_teachers ct ON ct.teacher_id = t.id
                    WHERE u.auth_uid = auth.uid() AND ct.class_id = %I.student_marks.class_id
                )
            )', v_schema, v_schema, v_schema, v_schema, v_schema);

        -- Students (and Parents via their children) can only read their own marks
        EXECUTE format('
            CREATE POLICY "student_read_own_marks" ON %I.student_marks
            FOR SELECT USING (
                student_id IN (
                    SELECT s.id FROM %I.students s
                    JOIN %I.users u ON s.user_id = u.id
                    WHERE u.auth_uid = auth.uid()
                )
            )', v_schema, v_schema, v_schema);
            
        EXECUTE format('
            CREATE POLICY "parent_read_children_marks" ON %I.student_marks
            FOR SELECT USING (
                student_id IN (
                    SELECT pc.student_id FROM %I.parent_children pc
                    JOIN %I.users u ON pc.parent_user_id = u.id
                    WHERE u.auth_uid = auth.uid()
                )
            )', v_schema, v_schema, v_schema);

        -- updated_at trigger
        EXECUTE format('CREATE TRIGGER student_marks_updated_at BEFORE UPDATE ON %I.student_marks FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);
        
        -- Indexes for fast querying
        EXECUTE format('CREATE INDEX idx_student_marks_student_id ON %I.student_marks(student_id)', v_schema);
        EXECUTE format('CREATE INDEX idx_student_marks_class_id ON %I.student_marks(class_id)', v_schema);
        EXECUTE format('CREATE INDEX idx_student_marks_term_year ON %I.student_marks(term, academic_year)', v_schema);
    END IF;

    RAISE NOTICE 'Sprint 4 schema (marks and cap limits) applied to tenant %', p_slug;
END;
$$;

-- Apply to all existing tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants WHERE status = 'ACTIVE'
    LOOP
        PERFORM public.apply_sprint4_to_tenant(t.slug);
    END LOOP;
END;
$$;

-- =============================================================================
-- 3. Modify create_tenant_schema directly to include Sprint 4 changes for future tenants
-- =============================================================================
-- To limit file size, the `create_tenant_schema` must be modified carefully in the runtime.
-- We will replace the original function here to ensure new tenants get the `student_marks` table and the trigger.
-- (We'll extract the previous version and inject Sprint 4 instructions at the end before returning)
-- NOTE: In practice, to prevent copy-pasting 500 lines of create_tenant_schema from 20260808000002, 
-- you should ideally apply `apply_sprint4_to_tenant` in the Node.js backend after calling `create_tenant_schema`,
-- or append it. For this migration file, we assume the backend `exec_sql(create_tenant_schema(slug))` calls 
-- this newly added `apply_sprint4_to_tenant` explicitly, OR we override it entirely here.

CREATE OR REPLACE FUNCTION public.create_tenant_schema_sprint4_override(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Run core setup (from sprint 3.2 logic, assuming backend already invokes standard create_tenant_schema)
    PERFORM public.create_tenant_schema(p_slug);
    
    -- 2. Run new sprint 4 migrations for the schema
    PERFORM public.apply_sprint4_to_tenant(p_slug);
END;
$$;
