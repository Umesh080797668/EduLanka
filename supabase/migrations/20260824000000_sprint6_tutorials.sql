-- =============================================================================
-- Migration: 20260824000000_sprint6_tutorials.sql
-- Description: Final Phase 2 tutorial seeds covering outstanding features
-- =============================================================================

-- Global Observability coverage
INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('e9999999-9999-9999-9999-999999999999', 'SUPER_ADMIN', 'dashboard')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (id, tutorial_id, target_element, title_en, content_en, step_order)
SELECT 
    uuid_generate_v4(), 
    id, 
    '#nav-dashboard', 
    'Supabase & Websocket Telemetry', 
    'This active dashboard natively renders real-time footprints intercepting direct WebSockets against the NodeJS servers, combined with Global Presence metrics dynamically provided exclusively by the Supabase Cloud instances simultaneously.', 
    99
FROM public.tutorials WHERE role = 'SUPER_ADMIN' AND screen_id = 'dashboard'
ON CONFLICT DO NOTHING;
