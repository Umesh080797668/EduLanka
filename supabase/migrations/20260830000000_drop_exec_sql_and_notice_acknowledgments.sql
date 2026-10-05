-- =============================================================================
-- Migration: 20260830000000_drop_exec_sql_and_notice_acknowledgments.sql
-- Description:
--   1. Drop legacy exec_sql function completely to eliminate dynamic SQL attack surface.
--   2. Enhance notices table with requires_acknowledgment flag.
--   3. Enhance notice_reads table with explicit acknowledged_at timestamp.
-- =============================================================================

-- 1. Drop exec_sql completely from public schema
DROP FUNCTION IF EXISTS public.exec_sql(TEXT);

-- 2. Enhance Notice Schema for True Acknowledgment Tracking
ALTER TABLE public.notices 
    ADD COLUMN IF NOT EXISTS requires_acknowledgment BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.notice_reads 
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notice_reads_acknowledged 
    ON public.notice_reads (notice_id, acknowledged_at);
