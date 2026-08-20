-- =============================================================================
-- Migration: 20260823000001_sprint5_tutorials.sql
-- Description: Inserting onboarding coach-marks specifically for Sprint 5 logic.
-- =============================================================================

INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('c9999999-9999-9999-9999-999999999999', 'SCHOOL_ADMIN', 'dashboard')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (id, tutorial_id, target_element, title_en, content_en, step_order)
SELECT 
    uuid_generate_v4(), 
    id, 
    '#disaster-mode-quick-action', 
    'Disaster Action Toggle', 
    'WARNING: Activating this engages the aggressive Twilio clusters, immediately dispatching a universal overriding SMS blast to all Parents synchronously mapped to your active enrollments and overriding regular tier constraints natively.', 
    99
FROM public.tutorials WHERE role = 'SCHOOL_ADMIN' AND screen_id = 'dashboard'
ON CONFLICT DO NOTHING;

-- Parent explanation
INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('d9999999-9999-9999-9999-999999999999', 'PARENT', 'dashboard')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (id, tutorial_id, target_element, title_en, content_en, step_order)
SELECT 
    uuid_generate_v4(), 
    id, 
    '#nav-notices', 
    'Emergency Receipts', 
    'If the Institution administrator enforces a Disaster Mode offline stance, a globally over-riding SMS message will instantly hit your verified phone device directly.', 
    99
FROM public.tutorials WHERE role = 'PARENT' AND screen_id = 'dashboard'
ON CONFLICT DO NOTHING;
