-- =============================================================================
-- EduLanka — Migration 001: Global Registry Tables
-- Run this ONCE in your Supabase project (SQL Editor or supabase db push)
-- =============================================================================

-- ── Extension ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM types (public schema)
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE public.tenant_plan   AS ENUM ('FREE', 'PRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.tenant_status AS ENUM (
        'PROVISIONING', 'ACTIVE', 'SUSPENDED', 'DEPROVISIONED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.school_type AS ENUM (
        'TYPE_1AB', 'TYPE_1C', 'TYPE_2', 'TYPE_3', 'PRIVATE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- public.tenants  — Tenant Registry (one row per school)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT            NOT NULL,
    slug            TEXT            NOT NULL UNIQUE,   -- schema name suffix
    plan            public.tenant_plan    NOT NULL DEFAULT 'FREE',
    status          public.tenant_status  NOT NULL DEFAULT 'PROVISIONING',
    school_type     public.school_type    NOT NULL,
    logo_url        TEXT,
    contact_email   TEXT            NOT NULL,
    phone_number    TEXT,
    -- Address (denormalised for simplicity)
    address_street  TEXT,
    address_city    TEXT,
    address_district TEXT,
    address_province TEXT,
    address_postal   TEXT,
    -- Audit cols
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- RLS: super admins (service-role can bypass; app-level callers see only their own)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Allow service-role full access (the NestJS API uses service-role key)
CREATE POLICY "service_role_all" ON public.tenants
    USING (true)
    WITH CHECK (true);

-- Tenants can only read their own row via JWT claim
CREATE POLICY "tenant_read_own" ON public.tenants
    FOR SELECT
    USING (id::TEXT = (auth.jwt() ->> 'tenantId'));

-- auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- public.plans  — Plan/Tier reference table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.plans (
    id          SERIAL          PRIMARY KEY,
    code        public.tenant_plan NOT NULL UNIQUE,
    label       TEXT            NOT NULL,
    price_lkr   INTEGER         NOT NULL DEFAULT 0,
    max_students INTEGER         NOT NULL DEFAULT 250, -- 0 = unlimited
    features    JSONB           NOT NULL DEFAULT '[]'::JSONB,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_can_read_plans" ON public.plans FOR SELECT USING (true);

INSERT INTO public.plans (code, label, price_lkr, max_students, features)
VALUES
    ('FREE', 'Free Package',  0,    250, '["static_report_cards","basic_chat","offline_3days"]'),
    ('PRO',  'Pro Package',   5000, 0,   '["unlimited_students","full_chat","disaster_mode","twilio_sms","offline_unlimited","video_hosting","ai_assistant","predictive_analytics","smart_timetable"]')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- create_tenant_schema(slug TEXT)  — Provision a new per-tenant schema
-- =============================================================================
-- Called from the NestJS TenantService after inserting into public.tenants.
-- Creates: schema, users, profiles tables with RLS.

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

    -- ── 2. users table ────────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.users (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            auth_uid        UUID        UNIQUE,          -- Supabase auth.users.id
            email           TEXT        NOT NULL UNIQUE,
            full_name       TEXT        NOT NULL,
            role            TEXT        NOT NULL,        -- UserRole enum value
            is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
            avatar_url      TEXT,
            phone_number    TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema);

    EXECUTE format('ALTER TABLE %I.users ENABLE ROW LEVEL SECURITY', v_schema);

    -- Service role bypass
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.users
        USING (true) WITH CHECK (true)', v_schema);

    -- Users can read/update their own row
    EXECUTE format('
        CREATE POLICY "user_read_own" ON %I.users
        FOR SELECT USING (auth_uid = auth.uid())', v_schema);

    EXECUTE format('
        CREATE POLICY "user_update_own" ON %I.users
        FOR UPDATE USING (auth_uid = auth.uid())', v_schema);

    -- ── 3. classes table ──────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.classes (
            id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            grade       SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 13),
            section     TEXT    NOT NULL,   -- e.g. "A", "B"
            year        SMALLINT NOT NULL,
            teacher_id  UUID    REFERENCES %I.users(id) ON DELETE SET NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(grade, section, year)
        )', v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.classes ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.classes
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "auth_users_read" ON %I.classes
        FOR SELECT USING (auth.role() = ''authenticated'')', v_schema);

    -- ── 4. students table ─────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.students (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         UUID        NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            class_id        UUID        REFERENCES %I.classes(id) ON DELETE SET NULL,
            admission_no    TEXT        NOT NULL UNIQUE,
            date_of_birth   DATE,
            gender          TEXT,
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
            user_id IN (SELECT id FROM %I.users WHERE auth_uid = auth.uid())
        )', v_schema, v_schema);

    -- ── 5. parents table ──────────────────────────────────────────────────────
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.parents (
            id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     UUID    NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
            student_id  UUID    NOT NULL REFERENCES %I.students(id) ON DELETE CASCADE,
            relationship TEXT   NOT NULL DEFAULT ''GUARDIAN'',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', v_schema, v_schema, v_schema);

    EXECUTE format('ALTER TABLE %I.parents ENABLE ROW LEVEL SECURITY', v_schema);
    EXECUTE format('
        CREATE POLICY "service_role_all" ON %I.parents
        USING (true) WITH CHECK (true)', v_schema);
    EXECUTE format('
        CREATE POLICY "parent_own" ON %I.parents
        FOR SELECT USING (
            user_id IN (SELECT id FROM %I.users WHERE auth_uid = auth.uid())
        )', v_schema, v_schema);

    -- ── 6. updated_at triggers ────────────────────────────────────────────────
    EXECUTE format('
        CREATE OR REPLACE FUNCTION %I.set_updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $fn$', v_schema);

    EXECUTE format('
        CREATE TRIGGER users_updated_at BEFORE UPDATE ON %I.users
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    EXECUTE format('
        CREATE TRIGGER classes_updated_at BEFORE UPDATE ON %I.classes
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    EXECUTE format('
        CREATE TRIGGER students_updated_at BEFORE UPDATE ON %I.students
        FOR EACH ROW EXECUTE FUNCTION %I.set_updated_at()', v_schema, v_schema);

    -- ── 7. Mark tenant ACTIVE ─────────────────────────────────────────────────
    UPDATE public.tenants SET status = 'ACTIVE' WHERE slug = p_slug;

    RAISE NOTICE 'Provisioned schema % for tenant slug %', v_schema, p_slug;
END;
$$;

-- Allow authenticated users to call this (actual guard is in NestJS layer — service key only)
REVOKE ALL ON FUNCTION public.create_tenant_schema(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_schema(TEXT) TO service_role;

-- =============================================================================
-- drop_tenant_schema(slug TEXT)  — Deprovision a tenant (destructive!)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.drop_tenant_schema(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schema TEXT := 'tenant_' || p_slug;
BEGIN
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', v_schema);
    UPDATE public.tenants SET status = 'DEPROVISIONED' WHERE slug = p_slug;
    RAISE NOTICE 'Dropped schema % for tenant slug %', v_schema, p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.drop_tenant_schema(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.drop_tenant_schema(TEXT) TO service_role;
