-- Migration: 20260808000003_mediums_and_subjects.sql
-- Adds instruction mediums to core tables for existing and newly provisioned tenants.

-- Update the RPC to include these columns going forward for new tenants
CREATE OR REPLACE FUNCTION public.create_tenant_schema(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    schema_name TEXT := 'tenant_' || p_slug;
BEGIN
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- 1. Create users table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL, -- references auth.users(id)
            tenant_id TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT,
            phone_number TEXT,
            avatar_url TEXT,
            role TEXT NOT NULL DEFAULT ''STUDENT'',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(user_id, tenant_id)
        );
    ', schema_name);

    -- 2. Create school_policy table (singleton)
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.school_policy (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id TEXT NOT NULL,
            academic_year INT NOT NULL DEFAULT extract(year from now()),
            max_students_per_class INT NOT NULL DEFAULT 40,
            allow_self_enrollment BOOLEAN NOT NULL DEFAULT false,
            sms_enabled BOOLEAN NOT NULL DEFAULT false,
            default_language TEXT NOT NULL DEFAULT ''en'',
            supported_mediums TEXT[] DEFAULT ARRAY[''ENGLISH''],
            timezone TEXT NOT NULL DEFAULT ''Asia/Colombo'',
            school_hours_start TIME NOT NULL DEFAULT ''07:30:00'',
            school_hours_end TIME NOT NULL DEFAULT ''13:30:00'',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id)
        );
    ', schema_name);

    -- 3. Create teachers table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.teachers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL, -- references enum users
            tenant_id TEXT NOT NULL,
            employee_no TEXT NOT NULL,
            subject_areas TEXT[] DEFAULT ''{}'',
            hire_date DATE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(employee_no)
        );
    ', schema_name);

    -- 4. Create classes table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.classes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id TEXT NOT NULL,
            grade INT NOT NULL,
            section TEXT NOT NULL,
            medium TEXT, -- e.g. ENGLISH, SINHALA, TAMIL
            year INT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(grade, section, year)
        );
    ', schema_name);

    -- 5. Create class_teachers assignments
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.class_teachers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            class_id UUID NOT NULL REFERENCES %I.classes(id) ON DELETE CASCADE,
            teacher_id UUID NOT NULL REFERENCES %I.teachers(id) ON DELETE CASCADE,
            is_homeroom BOOLEAN DEFAULT false,
            subject TEXT,
            UNIQUE(class_id, teacher_id, is_homeroom)
        );
    ', schema_name, schema_name, schema_name);

    -- 6. Create students table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.students (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            tenant_id TEXT NOT NULL,
            class_id UUID REFERENCES %I.classes(id) ON DELETE SET NULL,
            admission_no TEXT NOT NULL,
            date_of_birth DATE,
            gender TEXT,
            al_stream TEXT,
            medium TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(admission_no)
        );
    ', schema_name, schema_name);

    -- 7. parent_children table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.parent_children (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_user_id UUID NOT NULL, -- References users(user_id) where role = PARENT
            student_id UUID NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            relationship TEXT NOT NULL,
            UNIQUE(parent_user_id, student_id)
        );
    ', schema_name, schema_name);

END;
$$;

-- Apply to existing tenants
CREATE OR REPLACE FUNCTION public.apply_sprint3_1_to_tenant(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    schema_name TEXT := 'tenant_' || p_slug;
BEGIN
    -- Add supported_mediums to school_policy
    BEGIN
        EXECUTE format('ALTER TABLE %I.school_policy ADD COLUMN supported_mediums TEXT[] DEFAULT ARRAY[''ENGLISH'']', schema_name);
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    -- Add medium to classes
    BEGIN
        EXECUTE format('ALTER TABLE %I.classes ADD COLUMN medium TEXT', schema_name);
    EXCEPTION WHEN duplicate_column THEN NULL; END;

    -- Add medium to students
    BEGIN
        EXECUTE format('ALTER TABLE %I.students ADD COLUMN medium TEXT', schema_name);
    EXCEPTION WHEN duplicate_column THEN NULL; END;
END;
$$;

-- Execute for all active tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants
    LOOP
        PERFORM public.apply_sprint3_1_to_tenant(t.slug);
    END LOOP;
END;
$$;
