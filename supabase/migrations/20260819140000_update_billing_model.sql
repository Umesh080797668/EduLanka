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

-- Optional: Upsert the new plans matching the blueprint exactly.
INSERT INTO public.plans (code, label, base_fee_lkr, price_per_student_lkr, student_cap, storage_quota_gb, ai_token_quota_per_student, features)
VALUES
    ('COMMUNITY', 'Community Package', 0, 0, 75, 1, 0, '["static_report_cards","basic_chat"]'),
    ('STARTER', 'Starter Package', 1500, 20, NULL, 2, 0, '["full_chat","disaster_mode","twilio_sms","offline_sync"]'),
    ('GROWTH', 'Growth Package', 3000, 40, NULL, 15, 50000, '["video_hosting","paper_hub","ai_assistant"]'),
    ('INSTITUTIONAL', 'Institutional Package', 5000, 60, NULL, 50, 100000, '["early_warning","exam_prediction","teacher_analytics","smart_timetable"]')
ON CONFLICT (code) DO UPDATE SET 
    base_fee_lkr = EXCLUDED.base_fee_lkr,
    price_per_student_lkr = EXCLUDED.price_per_student_lkr,
    student_cap = EXCLUDED.student_cap,
    storage_quota_gb = EXCLUDED.storage_quota_gb,
    ai_token_quota_per_student = EXCLUDED.ai_token_quota_per_student,
    features = EXCLUDED.features;

-- Optionally assign migrated records from FREE/PRO to COMMUNITY/GROWTH or similar based on specific logics
UPDATE public.tenants SET plan = 'COMMUNITY' WHERE plan = 'FREE';
UPDATE public.tenants SET plan = 'INSTITUTIONAL' WHERE plan = 'PRO';

-- Then drop the old plans if they are no longer in use (we can just DELETE them so they dont appear)
DELETE FROM public.plans WHERE code IN ('FREE', 'PRO');

