-- =============================================================================
-- Migration: 20261014000000_media_retention_and_status.sql
-- Description:
-- 1. Add offline_retention_days to public.plans for S3 tier compliance.
-- 2. Allow 'deleted' in public.media_assets status constraint.
-- 3. Add last_synced_sequence to public.device_tokens for unsynced lag detection.
-- =============================================================================

-- 1. Offline retention days on plans
ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS offline_retention_days INTEGER NOT NULL DEFAULT 7;

UPDATE public.plans SET offline_retention_days = 0 WHERE code IN ('COMMUNITY', 'STARTER');
UPDATE public.plans SET offline_retention_days = 30 WHERE code = 'GROWTH';
UPDATE public.plans SET offline_retention_days = 90 WHERE code = 'INSTITUTIONAL';

-- 2. Status constraint on media_assets to include 'deleted'
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_status_check;
ALTER TABLE public.media_assets
    ADD CONSTRAINT media_assets_status_check
    CHECK (status IN ('processing', 'ready', 'failed', 'deleted'));

-- 3. Last synced sequence on device_tokens for telemetry lag detection
ALTER TABLE public.device_tokens
    ADD COLUMN IF NOT EXISTS last_synced_sequence BIGINT NOT NULL DEFAULT 0;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
