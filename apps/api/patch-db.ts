import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (!SUPABASE_URL) throw new Error('No url');
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const patchSql = `
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
            auth_uid        UUID        UNIQUE,          
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
            section     TEXT    NOT NULL,   
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

    NOTIFY pgrst, 'reload schema';
    RAISE NOTICE 'Provisioned schema % for tenant slug %', v_schema, p_slug;
END;
$$;
`;

async function patch() {
    const { error } = await admin.rpc('exec_sql', { sql: patchSql });
    if (error) console.error(error);
    else console.log('Successfully patched!');
}
patch();
