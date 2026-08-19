-- Migration 013: Update Billing Model for Hybrid Base Fee and Active Students

-- We must convert 'tenant_plan' enum to support the new tiers: Community, Starter, Growth, Institutional
-- Actually, the Blueprint states the tiers as: COMMUNITY, STARTER, GROWTH, INSTITUTIONAL,
-- replacing the old FREE, PRO.
-- It's easier just to alter the enum if possible, or add the new types.
ALTER TYPE public.tenant_plan ADD VALUE IF NOT EXISTS 'COMMUNITY';
ALTER TYPE public.tenant_plan ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE public.tenant_plan ADD VALUE IF NOT EXISTS 'GROWTH';
ALTER TYPE public.tenant_plan ADD VALUE IF NOT EXISTS 'INSTITUTIONAL';

-- Update public.plans table schema
ALTER TABLE public.plans DROP COLUMN IF EXISTS price_lkr CASCADE;
ALTER TABLE public.plans DROP COLUMN IF EXISTS max_students CASCADE;

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS base_fee_lkr INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_per_student_lkr INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS student_cap INTEGER; -- null = uncapped
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS storage_quota_gb INTEGER NOT NULL DEFAULT 2;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS ai_token_quota_per_student INTEGER NOT NULL DEFAULT 0;



