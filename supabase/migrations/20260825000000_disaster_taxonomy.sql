-- =============================================================================
-- Migration: 20260825000000_disaster_taxonomy.sql
-- Description: Extending schema to support strict Blueprint definitions for Phase 2 bounds
-- =============================================================================

-- 1. Disaster Taxonomy
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS disaster_reason TEXT,
ADD COLUMN IF NOT EXISTS disaster_resume_date TIMESTAMPTZ;

-- 2. Notice Scoping Vectors
-- Used when scope = 'GRADE_LEVEL' or 'CLASS_SPECIFIC'
ALTER TABLE public.notices
ADD COLUMN IF NOT EXISTS target_grade SMALLINT,
ADD COLUMN IF NOT EXISTS target_class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- Expose explicitly to Supabase Realtime optionally if needed.
