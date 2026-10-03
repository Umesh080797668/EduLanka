-- Migration: Drop leaky service_role_all policies
-- Description: Dropping permissive RLS policies created without 'TO service_role'.
-- In PostgreSQL/Supabase, omitting the TO clause applies the policy to PUBLIC (including anon and authenticated).
-- Since service_role already possesses the BYPASSRLS attribute, these policies are redundant and
-- created a critical cross-tenant data leak.

DROP POLICY IF EXISTS "service_role_all" ON public.tenants;
DROP POLICY IF EXISTS "service_all_tutorials" ON public.tutorials;
DROP POLICY IF EXISTS "service_all_steps" ON public.tutorial_steps;
DROP POLICY IF EXISTS "service_role_all" ON public.platform_admins;
DROP POLICY IF EXISTS "service_role_all" ON public.users;
DROP POLICY IF EXISTS "service_role_all" ON public.classes;
DROP POLICY IF EXISTS "service_role_all" ON public.teachers;
DROP POLICY IF EXISTS "service_role_all" ON public.class_teachers;
DROP POLICY IF EXISTS "service_role_all" ON public.students;
DROP POLICY IF EXISTS "service_role_all" ON public.parents;
DROP POLICY IF EXISTS "service_role_all" ON public.grades_config;
DROP POLICY IF EXISTS "service_role_all" ON public.student_marks;
DROP POLICY IF EXISTS "service_role_all" ON public.user_tutorials;
DROP POLICY IF EXISTS "service_role_all" ON public.school_policy;
DROP POLICY IF EXISTS "service_role_all_inq" ON public.deactivation_inquiries;
DROP POLICY IF EXISTS "service_role_all" ON public.audit_logs;
DROP POLICY IF EXISTS "service_role_all_chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "service_role_all_chat_participants" ON public.chat_participants;
DROP POLICY IF EXISTS "service_role_all_chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "service_role_all_chat_read_receipts" ON public.chat_read_receipts;
DROP POLICY IF EXISTS "service_role_notices" ON public.notices;
DROP POLICY IF EXISTS "service_role_notice_reads" ON public.notice_reads;
