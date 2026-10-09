-- =============================================================================
-- EduLanka — Dev Tenant Seed
-- Run AFTER migration 20260807000001_global_tables.sql
-- =============================================================================

-- =============================================================================
-- 0. Seed Supabase Auth (auth.users via Cloud SQL Editor)
-- Password for all users: SecurePass123!
-- =============================================================================
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
('00000000-0000-0000-0000-000000000000', '980f2893-68e0-4362-9890-fa2626826fc7', 'authenticated', 'authenticated', 'system@edulanka.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"role": "SUPER_ADMIN"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'ec390279-300d-4b82-b4a3-47337681ae2d', 'authenticated', 'authenticated', 'admin@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "SCHOOL_ADMIN"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'dcab3ce4-fdc0-44c1-8e4d-8d363d411380', 'authenticated', 'authenticated', 'teacher@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "TEACHER"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', '1559a7f0-1fe3-4038-914a-6ea03ca31bab', 'authenticated', 'authenticated', 'student@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "STUDENT"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae', 'authenticated', 'authenticated', 'parent@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "PARENT"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
-- Pilot Staging Users (matching Playwright Web E2E Specs)
('00000000-0000-0000-0000-000000000000', 'b0000001-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@pilot.edulanka.lk', crypt('PilotUser123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "SCHOOL_ADMIN", "full_name": "Pilot Admin"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000002-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teacher@pilot.edulanka.lk', crypt('PilotUser123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "TEACHER", "full_name": "Pilot Teacher"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000003-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student@pilot.edulanka.lk', crypt('PilotUser123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "STUDENT", "full_name": "Pilot Student"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000004-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'parent@pilot.edulanka.lk', crypt('PilotUser123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "45f9722b-eda0-453f-88d2-2c9ad06ec169", "role": "PARENT", "full_name": "Pilot Parent"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, id)
VALUES
('980f2893-68e0-4362-9890-fa2626826fc7', '980f2893-68e0-4362-9890-fa2626826fc7', format('{"sub":"%s","email":"%s"}', '980f2893-68e0-4362-9890-fa2626826fc7', 'system@edulanka.lk')::jsonb, 'email', gen_random_uuid()),
('ec390279-300d-4b82-b4a3-47337681ae2d', 'ec390279-300d-4b82-b4a3-47337681ae2d', format('{"sub":"%s","email":"%s"}', 'ec390279-300d-4b82-b4a3-47337681ae2d', 'admin@royal.lk')::jsonb, 'email', gen_random_uuid()),
('dcab3ce4-fdc0-44c1-8e4d-8d363d411380', 'dcab3ce4-fdc0-44c1-8e4d-8d363d411380', format('{"sub":"%s","email":"%s"}', 'dcab3ce4-fdc0-44c1-8e4d-8d363d411380', 'teacher@royal.lk')::jsonb, 'email', gen_random_uuid()),
('1559a7f0-1fe3-4038-914a-6ea03ca31bab', '1559a7f0-1fe3-4038-914a-6ea03ca31bab', format('{"sub":"%s","email":"%s"}', '1559a7f0-1fe3-4038-914a-6ea03ca31bab', 'student@royal.lk')::jsonb, 'email', gen_random_uuid()),
('de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae', 'de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae', format('{"sub":"%s","email":"%s"}', 'de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae', 'parent@royal.lk')::jsonb, 'email', gen_random_uuid()),
('b0000001-0000-0000-0000-000000000001', 'b0000001-0000-0000-0000-000000000001', format('{"sub":"%s","email":"%s"}', 'b0000001-0000-0000-0000-000000000001', 'admin@pilot.edulanka.lk')::jsonb, 'email', gen_random_uuid()),
('b0000002-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000002', format('{"sub":"%s","email":"%s"}', 'b0000002-0000-0000-0000-000000000002', 'teacher@pilot.edulanka.lk')::jsonb, 'email', gen_random_uuid()),
('b0000003-0000-0000-0000-000000000003', 'b0000003-0000-0000-0000-000000000003', format('{"sub":"%s","email":"%s"}', 'b0000003-0000-0000-0000-000000000003', 'student@pilot.edulanka.lk')::jsonb, 'email', gen_random_uuid()),
('b0000004-0000-0000-0000-000000000004', 'b0000004-0000-0000-0000-000000000004', format('{"sub":"%s","email":"%s"}', 'b0000004-0000-0000-0000-000000000004', 'parent@pilot.edulanka.lk')::jsonb, 'email', gen_random_uuid())
ON CONFLICT DO NOTHING;

-- 0.5. Insert the system-root tenant row for platform administration
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
    '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
    'System Administration',
    'system_root',
    'COMMUNITY',
    'ACTIVE',
    'TYPE_1AB',
    'admin@edulanka.lk',
    'Colombo',
    'Colombo',
    'Western Province'
) ON CONFLICT DO NOTHING;

-- 1. Insert the royal-college tenant row
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
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'Royal College Colombo',
    'royal-college',
    'INSTITUTIONAL',
    'PROVISIONING',  -- create_tenant_schema() will flip it to ACTIVE
    'TYPE_1AB',
    'admin@royal.lk',
    'Colombo',
    'Colombo',
    'Western Province'
) ON CONFLICT DO NOTHING;

-- 2. Provision the per-tenant schema
-- SELECT public.create_tenant_schema('royal-college');

-- 2.5 Force transition to ACTIVE in case RPC idempotency skips the status flip
UPDATE public.tenants SET status = 'ACTIVE' WHERE slug = 'royal-college';

-- =============================================================================
-- 3. Seed per-tenant users (inside public schema, properly linked to tenant)
-- NOTE: auth_uid values are placeholder UUIDs — link to real Supabase Auth users
--       after you invite them via the Supabase dashboard.
-- =============================================================================

-- System Admin (Platform Owner)
INSERT INTO public.platform_admins (id, user_id, email, full_name, role)
VALUES (
    '980f2893-68e0-4362-9890-fa2626826fc7',
    '980f2893-68e0-4362-9890-fa2626826fc7',
    'system@edulanka.lk',
    'System Admin',
    'SUPER_ADMIN'
) ON CONFLICT DO NOTHING;

-- School Admin
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'ec390279-300d-4b82-b4a3-47337681ae2d',
    'ec390279-300d-4b82-b4a3-47337681ae2d',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'admin@royal.lk',
    'Principal Perera',
    'SCHOOL_ADMIN'
) ON CONFLICT DO NOTHING;

-- Teacher
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'dcab3ce4-fdc0-44c1-8e4d-8d363d411380',
    'dcab3ce4-fdc0-44c1-8e4d-8d363d411380',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'teacher@royal.lk',
    'Ms. Silva',
    'TEACHER'
) ON CONFLICT DO NOTHING;

-- Student user
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    '1559a7f0-1fe3-4038-914a-6ea03ca31bab',
    '1559a7f0-1fe3-4038-914a-6ea03ca31bab',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'student@royal.lk',
    'Kasun Fernando',
    'STUDENT'
) ON CONFLICT DO NOTHING;

-- Parent user
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae',
    'de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'parent@royal.lk',
    'Mr. Fernando',
    'PARENT'
) ON CONFLICT DO NOTHING;

-- Teacher record
INSERT INTO public.teachers (id, tenant_id, user_id, employee_no)
VALUES (
    'bea8bd19-7f07-40e9-b635-29cd87af8a4b',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'dcab3ce4-fdc0-44c1-8e4d-8d363d411380',
    'EMP-001'
) ON CONFLICT DO NOTHING;

-- Class: Grade 10 Section A
INSERT INTO public.classes (id, tenant_id, grade, section, year)
VALUES (
    '5efafc07-194a-4811-829f-af8e126ddb08',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    10,
    'A',
    2026
) ON CONFLICT DO NOTHING;

-- Class: Grade 10 Section C
INSERT INTO public.classes (id, tenant_id, grade, section, year)
VALUES (
    '182e31e5-424c-4dd4-80d2-9254fd3c5f6c',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    10,
    'C',
    2026
) ON CONFLICT DO NOTHING;

-- Class: Grade 13 Bio
INSERT INTO public.classes (id, tenant_id, grade, section, year)
VALUES (
    '69e496c7-b6a2-4032-b846-e413404977db',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    13,
    'Bio',
    2026
) ON CONFLICT DO NOTHING;

-- class_teachers map
INSERT INTO public.class_teachers (id, tenant_id, class_id, teacher_id)
VALUES 
    (gen_random_uuid(), '45f9722b-eda0-453f-88d2-2c9ad06ec169', '5efafc07-194a-4811-829f-af8e126ddb08', 'bea8bd19-7f07-40e9-b635-29cd87af8a4b'),
    (gen_random_uuid(), '45f9722b-eda0-453f-88d2-2c9ad06ec169', '182e31e5-424c-4dd4-80d2-9254fd3c5f6c', 'bea8bd19-7f07-40e9-b635-29cd87af8a4b'),
    (gen_random_uuid(), '45f9722b-eda0-453f-88d2-2c9ad06ec169', '69e496c7-b6a2-4032-b846-e413404977db', 'bea8bd19-7f07-40e9-b635-29cd87af8a4b')
ON CONFLICT DO NOTHING;

-- Student record
INSERT INTO public.students (id, tenant_id, user_id, class_id, admission_no, date_of_birth, gender)
VALUES (
    'bcb2198f-8cb7-41dd-b3ad-691799c524de',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    '1559a7f0-1fe3-4038-914a-6ea03ca31bab',
    '5efafc07-194a-4811-829f-af8e126ddb08',
    'DS-2026-001',
    '2010-03-15',
    'MALE'
) ON CONFLICT DO NOTHING;

-- Parent → Student link (using public.parents, correctly targeting user_id instead of parent_user_id)
INSERT INTO public.parents (id, tenant_id, user_id, student_id, relationship)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'de0f092e-8abf-474b-8e2c-6cf5d2e1f4ae',
    'bcb2198f-8cb7-41dd-b3ad-691799c524de',
    'FATHER'
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. Seed Pilot Staging Users & Entities (Matching Playwright Web E2E Specs)
-- =============================================================================

-- Pilot School Admin
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000001',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'admin@pilot.edulanka.lk',
    'Pilot Admin',
    'SCHOOL_ADMIN'
) ON CONFLICT DO NOTHING;

-- Pilot Teacher
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000002-0000-0000-0000-000000000002',
    'b0000002-0000-0000-0000-000000000002',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'teacher@pilot.edulanka.lk',
    'Pilot Teacher',
    'TEACHER'
) ON CONFLICT DO NOTHING;

-- Pilot Student
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000003-0000-0000-0000-000000000003',
    'b0000003-0000-0000-0000-000000000003',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'student@pilot.edulanka.lk',
    'Pilot Student',
    'STUDENT'
) ON CONFLICT DO NOTHING;

-- Pilot Parent
INSERT INTO public.users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000004-0000-0000-0000-000000000004',
    'b0000004-0000-0000-0000-000000000004',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'parent@pilot.edulanka.lk',
    'Pilot Parent',
    'PARENT'
) ON CONFLICT DO NOTHING;

-- Pilot Teacher Record
INSERT INTO public.teachers (id, tenant_id, user_id, employee_no)
VALUES (
    'b0000005-0000-0000-0000-000000000005',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'b0000002-0000-0000-0000-000000000002',
    'EMP-PILOT-001'
) ON CONFLICT DO NOTHING;

-- Assign Pilot Teacher to Grade 10 Section A
INSERT INTO public.class_teachers (id, tenant_id, class_id, teacher_id)
VALUES (
    gen_random_uuid(),
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    '5efafc07-194a-4811-829f-af8e126ddb08',
    'b0000005-0000-0000-0000-000000000005'
) ON CONFLICT DO NOTHING;

-- Pilot Student Record
INSERT INTO public.students (id, tenant_id, user_id, class_id, admission_no, date_of_birth, gender)
VALUES (
    'b0000006-0000-0000-0000-000000000006',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'b0000003-0000-0000-0000-000000000003',
    '5efafc07-194a-4811-829f-af8e126ddb08',
    'DS-PILOT-001',
    '2010-05-20',
    'FEMALE'
) ON CONFLICT DO NOTHING;

-- Pilot Parent Link
INSERT INTO public.parents (id, tenant_id, user_id, student_id, relationship)
VALUES (
    'b0000007-0000-0000-0000-000000000007',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    'b0000004-0000-0000-0000-000000000004',
    'b0000006-0000-0000-0000-000000000006',
    'MOTHER'
) ON CONFLICT DO NOTHING;

-- School Policy for Tenant
INSERT INTO public.school_policy (id, tenant_id, max_students_per_class, academic_year, allow_self_enrollment, sms_enabled)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    '45f9722b-eda0-453f-88d2-2c9ad06ec169',
    30,
    2026,
    true,
    true
) ON CONFLICT (tenant_id) DO NOTHING;

-- Student Marks (Grade entries for teacher and student flows)
INSERT INTO public.student_marks (id, tenant_id, student_id, class_id, subject, term, mark, grade, academic_year)
VALUES 
    (gen_random_uuid(), '45f9722b-eda0-453f-88d2-2c9ad06ec169', 'b0000006-0000-0000-0000-000000000006', '5efafc07-194a-4811-829f-af8e126ddb08', 'Mathematics', 1, 88, 'A', 2026),
    (gen_random_uuid(), '45f9722b-eda0-453f-88d2-2c9ad06ec169', 'b0000006-0000-0000-0000-000000000006', '5efafc07-194a-4811-829f-af8e126ddb08', 'Science', 1, 79, 'B', 2026)
ON CONFLICT DO NOTHING;
