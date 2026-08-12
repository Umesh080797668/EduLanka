-- =============================================================================
-- EduLanka — Migration 008: Sprint 7 Single-Schema RLS Structural Collapse
-- =============================================================================
-- This migration irrevocably destroys the Schema-per-tenant architecture
-- and centralizes all data natively using JWT Row-Level-Security inside public.

-- 1. Destructively purge deprecated RPCs and existing isolated tenant schemas
DO $$ 
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants LOOP
        EXECUTE format('DROP SCHEMA IF EXISTS "tenant_%s" CASCADE', t.slug);
    END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.create_tenant_schema(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.drop_tenant_schema(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_tenant_schema_sprint4_override(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_tenant_schema_sprint6_override(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.apply_sprint3_to_tenant(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.apply_sprint5_to_tenant(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.apply_sprint6_to_tenant(TEXT) CASCADE;

-- =============================================================================
-- 2. Build Core Unified RLS Tables inside Public
-- =============================================================================

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        UNIQUE,          -- Supabase auth.users.id
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email           TEXT        NOT NULL,
    full_name       TEXT        NOT NULL,
    role            TEXT        NOT NULL,        -- UserRole enum
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    avatar_url      TEXT,
    phone_number    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_users" ON public.users USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.users USING (true) WITH CHECK (true);

-- CLASSES
CREATE TABLE IF NOT EXISTS public.classes (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    grade       SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 13),
    section     TEXT    NOT NULL,
    year        SMALLINT NOT NULL,
    medium      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, grade, section, year)
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_classes" ON public.classes USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.classes USING (true) WITH CHECK (true);

-- TEACHERS
CREATE TABLE IF NOT EXISTS public.teachers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    employee_no     TEXT        NOT NULL,
    subject_areas   TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    hire_date       DATE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, employee_no)
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_teachers" ON public.teachers USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.teachers USING (true) WITH CHECK (true);

-- CLASS TEACHERS
CREATE TABLE IF NOT EXISTS public.class_teachers (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID    NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id  UUID    NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    subject     TEXT,
    is_homeroom BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(class_id, teacher_id)
);

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_class_teachers" ON public.class_teachers USING (EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_teachers.class_id AND c.tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true)));
CREATE POLICY "service_role_all" ON public.class_teachers USING (true) WITH CHECK (true);

-- STUDENTS
CREATE TABLE IF NOT EXISTS public.students (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    class_id        UUID        REFERENCES public.classes(id) ON DELETE SET NULL,
    admission_no    TEXT        NOT NULL,
    al_stream       TEXT,
    date_of_birth   DATE,
    gender          TEXT,
    enrolled_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, admission_no)
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_students" ON public.students USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.students USING (true) WITH CHECK (true);

-- PARENTS
CREATE TABLE IF NOT EXISTS public.parents (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_id  UUID    NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    relationship TEXT   NOT NULL DEFAULT 'GUARDIAN',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_parents" ON public.parents USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.parents USING (true) WITH CHECK (true);

-- GRADES ENTITY (Linking to classes logically natively)
CREATE TABLE IF NOT EXISTS public.grades_config (
    id              SERIAL      PRIMARY KEY,
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    level           SMALLINT    NOT NULL,
    label           TEXT        NOT NULL,
    UNIQUE(tenant_id, level)
);

ALTER TABLE public.grades_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_grades_config" ON public.grades_config USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.grades_config USING (true) WITH CHECK (true);

-- STUDENT MARKS
CREATE TABLE IF NOT EXISTS public.student_marks (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id      UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id        UUID        NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    term            TEXT        NOT NULL,
    subject         TEXT        NOT NULL,
    marks           JSONB       NOT NULL DEFAULT '{}'::JSONB,
    total_score     NUMERIC,
    grade           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, student_id, term, subject)
);

ALTER TABLE public.student_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_student_marks" ON public.student_marks USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.student_marks USING (true) WITH CHECK (true);

-- USER TUTORIALS
CREATE TABLE IF NOT EXISTS public.user_tutorials (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tutorial_id     UUID        NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
    status          TEXT        NOT NULL CHECK (status IN ('COMPLETED', 'SKIPPED')),
    completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id, tutorial_id)
);

ALTER TABLE public.user_tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_user_tutorials" ON public.user_tutorials USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true));
CREATE POLICY "service_role_all" ON public.user_tutorials USING (true) WITH CHECK (true);

-- 3. Trigger Support
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
