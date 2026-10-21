-- =============================================================================
-- Migration: 20261021090000_add_notice_medium.sql
-- Description: Adds instruction medium column to notices table for language-medium scoping.
-- =============================================================================

ALTER TABLE public.notices
    ADD COLUMN IF NOT EXISTS medium TEXT CHECK (medium IN ('ENGLISH', 'SINHALA', 'TAMIL') OR medium IS NULL);

CREATE INDEX IF NOT EXISTS idx_notices_tenant_medium
    ON public.notices (tenant_id, medium);
