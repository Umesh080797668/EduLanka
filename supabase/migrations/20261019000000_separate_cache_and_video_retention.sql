-- =============================================================================
-- Migration: 20261019000000_separate_cache_and_video_retention.sql
-- Description:
-- Separates cache retention (SQLite text records: chat, comments, attendance)
-- from video download retention (encrypted lessons):
--   - offline_retention_days (cache): Starter 7, Growth & Institutional 0 (unlimited)
--   - video_retention_days (downloads): Starter 0 (no downloads), Growth 30, Institutional 90
-- =============================================================================

ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS video_retention_days INTEGER NOT NULL DEFAULT 0;

-- 1. Cache retention (offline text cache)
-- Starter prunes after 7 days; Growth and Institutional retain indefinitely (0 = unlimited).
UPDATE public.plans SET offline_retention_days = 7 WHERE code IN ('COMMUNITY', 'STARTER');
UPDATE public.plans SET offline_retention_days = 0 WHERE code IN ('GROWTH', 'INSTITUTIONAL');

-- 2. Video download retention
-- Starter and Community have 0 (video downloads disabled; embed links only).
-- Growth has 30 days; Institutional has 90 days.
UPDATE public.plans SET video_retention_days = 0 WHERE code IN ('COMMUNITY', 'STARTER');
UPDATE public.plans SET video_retention_days = 30 WHERE code = 'GROWTH';
UPDATE public.plans SET video_retention_days = 90 WHERE code = 'INSTITUTIONAL';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
