-- Migration 20261020000002: Update Plan Features Matrix according to Blueprint Section 7
-- Settles the canonical features matrix:
-- COMMUNITY: static report cards, school notices (NO chat, NO disaster mode, NO targeted notices, NO blogs)
-- STARTER: everything in Community + chat, targeted notices, disaster mode, twilio SMS, school blogs, basic offline sync
-- GROWTH: everything in Starter + platform blogs, video hosting, paper hub, full offline sync, AI assistant
-- INSTITUTIONAL: everything in Growth + early warning, exam prediction, teacher analytics, smart timetable

UPDATE public.plans
SET features = '["static_report_cards", "school_notices"]'::jsonb
WHERE code = 'COMMUNITY';

UPDATE public.plans
SET features = '["static_report_cards", "school_notices", "chat", "targeted_notices", "disaster_mode", "twilio_sms", "blogs_school", "offline_sync"]'::jsonb
WHERE code = 'STARTER';

UPDATE public.plans
SET features = '["static_report_cards", "school_notices", "chat", "targeted_notices", "disaster_mode", "twilio_sms", "blogs_school", "offline_sync", "blogs_platform", "video_hosting", "paper_hub", "ai_assistant"]'::jsonb
WHERE code = 'GROWTH';

UPDATE public.plans
SET features = '["static_report_cards", "school_notices", "chat", "targeted_notices", "disaster_mode", "twilio_sms", "blogs_school", "offline_sync", "blogs_platform", "video_hosting", "paper_hub", "ai_assistant", "early_warning", "exam_prediction", "teacher_analytics", "smart_timetable"]'::jsonb
WHERE code = 'INSTITUTIONAL';
