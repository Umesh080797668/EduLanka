-- Migration 014: Seed Billing Plans (Run after 20260819140000_update_billing_model.sql)
-- This file exists separately to bypass the PostgreSQL "unsafe use of new enum value" limitation 
-- which occurs when inserting a new ENUM type value in the same transaction block it was created in.

-- Completely flush old records and reset the id sequence back to 1
TRUNCATE TABLE public.plans RESTART IDENTITY;

-- Upsert the new plans matching the blueprint exactly.
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

