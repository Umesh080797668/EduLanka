-- =============================================================================
-- EduLanka — Dev Tenant Seed
-- Run AFTER migration 20260807000001_global_tables.sql
-- =============================================================================

-- 1. Insert the dev-school tenant row
INSERT INTO public.tenants (
    id,
    name,
    slug,
    plan,
    status,
    school_type,
    contact_email,
    address_city,
    address_district,
    address_province
) VALUES (
    'a1b2c3d4-0000-0000-0000-000000000001',
    'EduLanka Dev School',
    'dev-school',
    'PRO',
    'PROVISIONING',  -- create_tenant_schema() will flip it to ACTIVE
    'TYPE_1AB',
    'dev@edulanka.lk',
    'Colombo',
    'Colombo',
    'Western Province'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Provision the per-tenant schema
SELECT public.create_tenant_schema('dev-school');

-- =============================================================================
-- 3. Seed per-tenant users (inside tenant_dev-school schema)
-- NOTE: auth_uid values are placeholder UUIDs — link to real Supabase Auth users
--       after you invite them via the Supabase dashboard.
-- =============================================================================

-- School Admin
INSERT INTO "tenant_dev-school".users (id, auth_uid, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    NULL,
    'admin@dev-school.lk',
    'Dev School Admin',
    'SCHOOL_ADMIN'
) ON CONFLICT (email) DO NOTHING;

-- Teacher
INSERT INTO "tenant_dev-school".users (id, auth_uid, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    NULL,
    'teacher@dev-school.lk',
    'Dev Teacher',
    'TEACHER'
) ON CONFLICT (email) DO NOTHING;

-- Student user
INSERT INTO "tenant_dev-school".users (id, auth_uid, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000003',
    NULL,
    'student@dev-school.lk',
    'Dev Student',
    'STUDENT'
) ON CONFLICT (email) DO NOTHING;

-- Parent user
INSERT INTO "tenant_dev-school".users (id, auth_uid, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000004',
    NULL,
    'parent@dev-school.lk',
    'Dev Parent',
    'PARENT'
) ON CONFLICT (email) DO NOTHING;

-- Class: Grade 10 Section A
INSERT INTO "tenant_dev-school".classes (id, grade, section, year, teacher_id)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    10,
    'A',
    2026,
    'b0000000-0000-0000-0000-000000000002'
) ON CONFLICT (grade, section, year) DO NOTHING;

-- Class: Grade 10 Section C (Owned by same teacher)
INSERT INTO "tenant_dev-school".classes (id, grade, section, year, teacher_id)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    10,
    'C',
    2026,
    'b0000000-0000-0000-0000-000000000002'
) ON CONFLICT (grade, section, year) DO NOTHING;

-- Class: Grade 13 Bio (Owned by same teacher)
INSERT INTO "tenant_dev-school".classes (id, grade, section, year, teacher_id)
VALUES (
    'c0000000-0000-0000-0000-000000000003',
    13,
    'Bio',
    2026,
    'b0000000-0000-0000-0000-000000000002'
) ON CONFLICT (grade, section, year) DO NOTHING;

-- Student record
INSERT INTO "tenant_dev-school".students (id, user_id, class_id, admission_no, date_of_birth, gender)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    'DS-2026-001',
    '2010-03-15',
    'MALE'
) ON CONFLICT (admission_no) DO NOTHING;

-- Parent → Student link
INSERT INTO "tenant_dev-school".parents (id, user_id, student_id, relationship)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'FATHER'
) ON CONFLICT (id) DO NOTHING;
