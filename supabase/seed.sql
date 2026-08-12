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
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'system@edulanka.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"role": "SUPER_ADMIN"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "a1b2c3d4-0000-0000-0000-000000000001", "role": "SCHOOL_ADMIN"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teacher@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "a1b2c3d4-0000-0000-0000-000000000001", "role": "TEACHER"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'student@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "a1b2c3d4-0000-0000-0000-000000000001", "role": "STUDENT"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'parent@royal.lk', crypt('SecurePass123!', gen_salt('bf')), CURRENT_TIMESTAMP, '{"provider":"email","providers":["email"]}', '{"tenant_id": "a1b2c3d4-0000-0000-0000-000000000001", "role": "PARENT"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, id)
VALUES
('b0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', format('{"sub":"%s","email":"%s"}', 'b0000000-0000-0000-0000-000000000000', 'system@edulanka.lk')::jsonb, 'email', uuid_generate_v4()),
('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', format('{"sub":"%s","email":"%s"}', 'b0000000-0000-0000-0000-000000000001', 'admin@royal.lk')::jsonb, 'email', uuid_generate_v4()),
('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', format('{"sub":"%s","email":"%s"}', 'b0000000-0000-0000-0000-000000000002', 'teacher@royal.lk')::jsonb, 'email', uuid_generate_v4()),
('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', format('{"sub":"%s","email":"%s"}', 'b0000000-0000-0000-0000-000000000003', 'student@royal.lk')::jsonb, 'email', uuid_generate_v4()),
('b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', format('{"sub":"%s","email":"%s"}', 'b0000000-0000-0000-0000-000000000004', 'parent@royal.lk')::jsonb, 'email', uuid_generate_v4())
ON CONFLICT DO NOTHING;

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
    'a1b2c3d4-0000-0000-0000-000000000001',
    'Royal College Colombo',
    'royal-college',
    'PRO',
    'PROVISIONING',  -- create_tenant_schema() will flip it to ACTIVE
    'TYPE_1AB',
    'admin@royal.lk',
    'Colombo',
    'Colombo',
    'Western Province'
) ON CONFLICT DO NOTHING;

-- 2. Provision the per-tenant schema
SELECT public.create_tenant_schema('royal-college');

-- 2.5 Force transition to ACTIVE in case RPC idempotency skips the status flip
UPDATE public.tenants SET status = 'ACTIVE' WHERE slug = 'royal-college';

-- =============================================================================
-- 3. Seed per-tenant users (inside tenant_royal-college schema)
-- NOTE: auth_uid values are placeholder UUIDs — link to real Supabase Auth users
--       after you invite them via the Supabase dashboard.
-- =============================================================================

-- System Admin (Platform Owner)
INSERT INTO public.platform_admins (id, user_id, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000000',
    'b0000000-0000-0000-0000-000000000000',
    'system@edulanka.lk',
    'System Admin',
    'SUPER_ADMIN'
) ON CONFLICT DO NOTHING;

-- School Admin
INSERT INTO "tenant_royal-college".users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'admin@royal.lk',
    'Principal Perera',
    'SCHOOL_ADMIN'
) ON CONFLICT DO NOTHING;

-- Teacher
INSERT INTO "tenant_royal-college".users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'teacher@royal.lk',
    'Ms. Silva',
    'TEACHER'
) ON CONFLICT DO NOTHING;

-- Student user
INSERT INTO "tenant_royal-college".users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'student@royal.lk',
    'Kasun Fernando',
    'STUDENT'
) ON CONFLICT DO NOTHING;

-- Parent user
INSERT INTO "tenant_royal-college".users (id, user_id, tenant_id, email, full_name, role)
VALUES (
    'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000004',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'parent@royal.lk',
    'Mr. Fernando',
    'PARENT'
) ON CONFLICT DO NOTHING;

-- Teacher record
INSERT INTO "tenant_royal-college".teachers (id, tenant_id, user_id, employee_no)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'EMP-001'
) ON CONFLICT DO NOTHING;

-- Class: Grade 10 Section A
INSERT INTO "tenant_royal-college".classes (id, tenant_id, grade, section, year)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    10,
    'A',
    2026
) ON CONFLICT DO NOTHING;

-- Class: Grade 10 Section C (Owned by same teacher)
INSERT INTO "tenant_royal-college".classes (id, tenant_id, grade, section, year)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'a1b2c3d4-0000-0000-0000-000000000001',
    10,
    'C',
    2026
) ON CONFLICT DO NOTHING;

-- Class: Grade 13 Bio (Owned by same teacher)
INSERT INTO "tenant_royal-college".classes (id, tenant_id, grade, section, year)
VALUES (
    'c0000000-0000-0000-0000-000000000003',
    'a1b2c3d4-0000-0000-0000-000000000001',
    13,
    'Bio',
    2026
) ON CONFLICT DO NOTHING;

-- class_teachers map
INSERT INTO "tenant_royal-college".class_teachers (id, class_id, teacher_id)
VALUES 
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Student record
INSERT INTO "tenant_royal-college".students (id, tenant_id, user_id, class_id, admission_no, date_of_birth, gender)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    'DS-2026-001',
    '2010-03-15',
    'MALE'
) ON CONFLICT DO NOTHING;

-- Parent → Student link
INSERT INTO "tenant_royal-college".parent_children (id, parent_user_id, student_id, relationship)
VALUES (
    'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001',
    'FATHER'
) ON CONFLICT DO NOTHING;
