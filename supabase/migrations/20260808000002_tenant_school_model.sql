-- =============================================================================
-- EduLanka — Migration 002: Core School Data Model (Sprint 3)
-- Run ONCE in your Supabase project after migration 001.
-- =============================================================================
-- What this migration adds inside every tenant schema (applied to new tenants
-- automatically via the updated create_tenant_schema() RPC, and to already-
-- provisioned tenants via apply_sprint3_to_tenant()).
-- =============================================================================

-- ── New global ENUMs ──────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE public.parent_relationship AS ENUM (
        'FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.subject_area AS ENUM (
        -- Primary & Common Core (Grades 1-9)
        'SINHALA', 'TAMIL', 'ENGLISH', 'MATHEMATICS', 'ENVIRONMENT',
        'RELIGION_BUDDHIST', 'RELIGION_CHRISTIAN', 'RELIGION_CATHOLIC', 'RELIGION_ISLAM', 'RELIGION_HINDU',
        'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'CIVICS', 'HEALTH_PE', 'PTS',
        
        -- O/L & A/L Common Elective Subjects (Languages & Aesthetics)
        'PALI', 'SANSKRIT', 'FRENCH', 'JAPANESE', 'GERMAN', 'CHINESE', 'KOREAN', 'RUSSIAN', 'HINDI', 'ARABIC', 'MALAY',
        'ART', 'ORIENTAL_MUSIC', 'WESTERN_MUSIC', 'CARNATIC_MUSIC', 'ORIENTAL_DANCING', 'BHARATHA_DANCING',
        
        -- Specific O/L Subjects
        'BUSINESS_ACCOUNTING', 'ENTREPRENEURSHIP', 'SECOND_LANGUAGE_SINHALA', 'SECOND_LANGUAGE_TAMIL',
        'DRAMA_SINHALA', 'DRAMA_TAMIL', 'DRAMA_ENGLISH',
        'LITERATURE_SINHALA', 'LITERATURE_TAMIL', 'LITERATURE_ENGLISH', 'LITERATURE_ARABIC',
        'ICT', 'AGRICULTURE', 'MECH_TECH', 'CIVIL_TECH', 'ELEC_TECH', 'HOME_ECONOMICS', 
        'MEDIA_STUDIES', 'ART_CRAFT', 'AQUATIC_TECH',
        
        -- Specific A/L Subjects
        'GENERAL_ENGLISH', 'CGT', 'GIT',
        'COMBINED_MATHS', 'PHYSICS', 'CHEMISTRY', 'HIGHER_MATHS', 'BIOLOGY', 'AGRI_SCIENCE',
        'ACCOUNTING', 'BUSINESS_STUDIES', 'ECONOMICS', 'BUSINESS_STATISTICS', 
        'SCIENCE_FOR_TECH', 'ENGINEERING_TECH', 'BIOSYSTEMS_TECH',
        'POLITICAL_SCIENCE', 'LOGIC', 'HISTORY_SRI_LANKAN', 'HISTORY_INDIAN', 'HISTORY_MODERN_WORLD',
        'BUDDHIST_CIV', 'HINDU_CIV', 'ISLAMIC_CIV', 'GREEK_ROMAN_CIV',
        
        -- Other
        'PHYSICAL_EDUCATION', 'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.al_stream AS ENUM (
        'SCIENCE', 'MATHS', 'COMMERCE', 'ARTS', 'TECHNOLOGY', 'BIO_SCIENCE', 'COMMON'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- Helper function: apply Sprint 3 tables to a specific tenant schema.
-- Called automatically from create_tenant_schema() for new tenants,
-- and can be called manually for existing tenants.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_sprint3_to_tenant(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schema TEXT := 'tenant_' || p_slug;
BEGIN
    -- ── 1. Add al_stream column to students (if not already there) ────────────
    EXECUTE format(
        'ALTER TABLE %I.students ADD COLUMN IF NOT EXISTS al_stream TEXT',
        v_schema
    );

    -- ── 2. teachers table ─────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.teachers (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID        NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            employee_no     TEXT        NOT NULL UNIQUE,
            subject_areas   TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
            hire_date       DATE,
            is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.teachers ENABLE ROW LEVEL SECURITY', v_schema);
    BEGIN EXECUTE format('CREATE POLICY "service_role_all" ON %I.teachers USING (true) WITH CHECK (true)', v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('
        CREATE POLICY "teacher_own" ON %I.teachers
        FOR SELECT USING (
            user_id IN (SELECT id FROM %I.users WHERE user_id = auth.uid())
        )', v_schema, v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('
        CREATE POLICY "admin_all_teachers" ON %I.teachers
        USING (
            EXISTS (
                SELECT 1 FROM %I.users u
                WHERE u.user_id = auth.uid() AND u.role IN (''SCHOOL_ADMIN'')
            )
        )', v_schema, v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;

    BEGIN EXECUTE format('CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON %I.teachers FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- ── 3. class_teachers join table (many-to-many) ───────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.class_teachers (
            id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id    UUID    NOT NULL REFERENCES %I.classes(id) ON DELETE CASCADE,
            teacher_id  UUID    NOT NULL REFERENCES %I.teachers(id) ON DELETE CASCADE,
            is_homeroom BOOLEAN NOT NULL DEFAULT FALSE,
            subject     TEXT,
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(class_id, teacher_id)
        )', v_schema, v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.class_teachers ENABLE ROW LEVEL SECURITY', v_schema);
    BEGIN EXECUTE format('CREATE POLICY "service_role_all" ON %I.class_teachers USING (true) WITH CHECK (true)', v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('CREATE POLICY "auth_users_read" ON %I.class_teachers FOR SELECT USING (auth.role() = ''authenticated'')', v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- ── 4. Remove old single-child parents table; add parent_children join ────
    -- (Only drop if the old schema exists; idempotent guard)
    EXECUTE format(
        'DROP TABLE IF EXISTS %I.parents', v_schema
    );

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.parent_children (
            id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_user_id  UUID    NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            student_id      UUID    NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            relationship    TEXT    NOT NULL DEFAULT ''GUARDIAN'',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(parent_user_id, student_id)
        )', v_schema, v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.parent_children ENABLE ROW LEVEL SECURITY', v_schema);
    BEGIN EXECUTE format('CREATE POLICY "service_role_all" ON %I.parent_children USING (true) WITH CHECK (true)', v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('
        CREATE POLICY "parent_own_children" ON %I.parent_children
        FOR SELECT USING (
            parent_user_id IN (SELECT id FROM %I.users WHERE user_id = auth.uid())
        )', v_schema, v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('
        CREATE POLICY "student_own_parents" ON %I.parent_children
        FOR SELECT USING (
            student_id IN (
                SELECT s.id FROM %I.students s
                JOIN %I.users u ON s.user_id = u.id
                WHERE u.user_id = auth.uid()
            )
        )', v_schema, v_schema, v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- ── 5. school_policy table (single-row per tenant) ────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.school_policy (
            id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            academic_year           SMALLINT    NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::SMALLINT,
            max_students_per_class  SMALLINT    NOT NULL DEFAULT 40,
            allow_self_enrollment   BOOLEAN     NOT NULL DEFAULT FALSE,
            sms_enabled             BOOLEAN     NOT NULL DEFAULT FALSE,
            default_language        TEXT        NOT NULL DEFAULT ''en'',
            timezone                TEXT        NOT NULL DEFAULT ''Asia/Colombo'',
            school_hours_start      TIME        NOT NULL DEFAULT ''07:30:00'',
            school_hours_end        TIME        NOT NULL DEFAULT ''14:00:00'',
            extra_config            JSONB       NOT NULL DEFAULT ''{}''::JSONB,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema);

    -- Seed a default policy row if not already present
    EXECUTE format('
        INSERT INTO %I.school_policy
            (academic_year, max_students_per_class, allow_self_enrollment, sms_enabled)
        SELECT
            EXTRACT(YEAR FROM NOW())::SMALLINT, 40, FALSE, FALSE
        WHERE NOT EXISTS (SELECT 1 FROM %I.school_policy)',
        v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.school_policy ENABLE ROW LEVEL SECURITY', v_schema);
    BEGIN EXECUTE format('CREATE POLICY "service_role_all" ON %I.school_policy USING (true) WITH CHECK (true)', v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('CREATE POLICY "auth_users_read_policy" ON %I.school_policy FOR SELECT USING (auth.role() = ''authenticated'')', v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN EXECUTE format('CREATE TRIGGER school_policy_updated_at BEFORE UPDATE ON %I.school_policy FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema); EXCEPTION WHEN duplicate_object THEN NULL; END;

    -- ── 6. Performance indexes ────────────────────────────────────────────────
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_students_class_id ON %I.students(class_id)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_students_user_id ON %I.students(user_id)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON %I.teachers(user_id)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON %I.class_teachers(class_id)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON %I.class_teachers(teacher_id)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON %I.parent_children(parent_user_id)',
        v_schema);
    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_parent_children_student ON %I.parent_children(student_id)',
        v_schema);

    RAISE NOTICE 'Sprint 3 schema applied to tenant %', p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sprint3_to_tenant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_sprint3_to_tenant(TEXT) TO service_role;

-- =============================================================================
-- Update create_tenant_schema() to include all Sprint 3 tables for new tenants
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schema TEXT := 'tenant_' || p_slug;
BEGIN
    -- ── 1. Create schema ──────────────────────────────────────────────────────
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

    -- ── 2. updated_at trigger function first (used by all tables) ─────────────
    EXECUTE format('
        CREATE OR REPLACE FUNCTION %I.set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $fn$', v_schema);

    -- ── 3. users table ────────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id        UUID        UNIQUE,
            email           TEXT        NOT NULL UNIQUE,
            full_name       TEXT        NOT NULL,
            role            TEXT        NOT NULL,
            is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
            avatar_url      TEXT,
            phone_number    TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema);

    EXECUTE format('ALTER TABLE %I.users ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.users
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "user_read_own" ON %I.users
        FOR SELECT USING (user_id = auth.uid())', v_schema);
    EXECUTE format('
        CREATE POLICY "user_update_own" ON %I.users
        FOR UPDATE USING (user_id = auth.uid())', v_schema);
    EXECUTE format('
        CREATE TRIGGER users_updated_at BEFORE UPDATE ON %I.users
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    -- ── 4. classes table ──────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.classes (
            id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            grade       SMALLINT    NOT NULL CHECK (grade BETWEEN 1 AND 13),
            section     TEXT        NOT NULL,
            year        SMALLINT    NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(grade, section, year)
        )', v_schema);

    EXECUTE format('ALTER TABLE %I.classes ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.classes
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "auth_users_read" ON %I.classes
        FOR SELECT USING (auth.role() = ''authenticated'')', v_schema);
    EXECUTE format('
        CREATE TRIGGER classes_updated_at BEFORE UPDATE ON %I.classes
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    -- ── 5. students table ─────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.students (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID        NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            class_id        UUID        REFERENCES %I.classes(id) ON DELETE SET NULL,
            admission_no    TEXT        NOT NULL UNIQUE,
            date_of_birth   DATE,
            gender          TEXT,
            al_stream       TEXT,
            enrolled_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema, v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.students ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.students
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "student_own" ON %I.students
        FOR SELECT USING (
            user_id IN (SELECT id FROM %I.users WHERE user_id = auth.uid())
        )', v_schema, v_schema);
    EXECUTE format('
        CREATE TRIGGER students_updated_at BEFORE UPDATE ON %I.students
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    -- ── 6. teachers table ─────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.teachers (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID        NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            employee_no     TEXT        NOT NULL UNIQUE,
            subject_areas   TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
            hire_date       DATE,
            is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.teachers ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.teachers
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "teacher_own" ON %I.teachers
        FOR SELECT USING (
            user_id IN (SELECT id FROM %I.users WHERE user_id = auth.uid())
        )', v_schema, v_schema);
    EXECUTE format('
        CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON %I.teachers
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    -- ── 7. class_teachers join table ──────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.class_teachers (
            id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id    UUID    NOT NULL REFERENCES %I.classes(id) ON DELETE CASCADE,
            teacher_id  UUID    NOT NULL REFERENCES %I.teachers(id) ON DELETE CASCADE,
            is_homeroom BOOLEAN NOT NULL DEFAULT FALSE,
            subject     TEXT,
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(class_id, teacher_id)
        )', v_schema, v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.class_teachers ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.class_teachers
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "auth_users_read" ON %I.class_teachers
        FOR SELECT USING (auth.role() = ''authenticated'')', v_schema);

    -- ── 8. parent_children join table ─────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.parent_children (
            id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_user_id  UUID    NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            student_id      UUID    NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            relationship    TEXT    NOT NULL DEFAULT ''GUARDIAN'',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(parent_user_id, student_id)
        )', v_schema, v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.parent_children ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.parent_children
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "parent_own_children" ON %I.parent_children
        FOR SELECT USING (
            parent_user_id IN (SELECT id FROM %I.users WHERE user_id = auth.uid())
        )', v_schema, v_schema);
    EXECUTE format('
        CREATE POLICY "student_own_parents" ON %I.parent_children
        FOR SELECT USING (
            student_id IN (
                SELECT s.id FROM %I.students s
                JOIN %I.users u ON s.user_id = u.id
                WHERE u.user_id = auth.uid()
            )
        )', v_schema, v_schema, v_schema);

    -- ── 9. school_policy table ────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.school_policy (
            id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            academic_year           SMALLINT    NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::SMALLINT,
            max_students_per_class  SMALLINT    NOT NULL DEFAULT 40,
            allow_self_enrollment   BOOLEAN     NOT NULL DEFAULT FALSE,
            sms_enabled             BOOLEAN     NOT NULL DEFAULT FALSE,
            default_language        TEXT        NOT NULL DEFAULT ''en'',
            timezone                TEXT        NOT NULL DEFAULT ''Asia/Colombo'',
            school_hours_start      TIME        NOT NULL DEFAULT ''07:30:00'',
            school_hours_end        TIME        NOT NULL DEFAULT ''14:00:00'',
            extra_config            JSONB       NOT NULL DEFAULT ''{}''::JSONB,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema);

    EXECUTE format('
        INSERT INTO %I.school_policy
            (academic_year, max_students_per_class, allow_self_enrollment, sms_enabled)
        VALUES (EXTRACT(YEAR FROM NOW())::SMALLINT, 40, FALSE, FALSE)',
        v_schema);

    EXECUTE format('ALTER TABLE %I.school_policy ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.school_policy
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "auth_users_read_policy" ON %I.school_policy
        FOR SELECT USING (auth.role() = ''authenticated'')', v_schema);
    EXECUTE format('
        CREATE TRIGGER school_policy_updated_at BEFORE UPDATE ON %I.school_policy
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    -- ── 10. Performance indexes ───────────────────────────────────────────────
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_students_class_id ON %I.students(class_id)', v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_students_user_id ON %I.students(user_id)', v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON %I.teachers(user_id)', v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_class_teachers_class ON %I.class_teachers(class_id)', v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON %I.class_teachers(teacher_id)', v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON %I.parent_children(parent_user_id)', v_schema);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_parent_children_student ON %I.parent_children(student_id)', v_schema);

    -- ── 11. Mark tenant ACTIVE ────────────────────────────────────────────────
    UPDATE public.tenants SET status = 'ACTIVE' WHERE slug = p_slug;

    RAISE NOTICE 'Provisioned full schema % for tenant slug %', v_schema, p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_schema(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_schema(TEXT) TO service_role;

-- =============================================================================
-- Execute Migration 2 for all currently active tenants automatically
-- =============================================================================
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants
    LOOP
        PERFORM public.apply_sprint3_to_tenant(t.slug);
    END LOOP;
END;
$$;
