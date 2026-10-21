-- =============================================================================
-- Migration: 20261021080000_composite_indexes_student_marks_sync_events.sql
-- Description:
-- 1. Adds composite index on (tenant_id, created_at) for student_marks aggregation queries
-- 2. Adds user_id and status columns to sync_events if not present, and creates compound
--    index on (tenant_id, user_id, status) for multi-tenant delta syncs
-- 3. Adds guided tour definitions and steps for Parent Portal grade inspection
--    and parent-teacher chat initiation
-- =============================================================================

-- 1. Composite index on student_marks for aggregation queries
CREATE INDEX IF NOT EXISTS idx_student_marks_tenant_created
    ON public.student_marks(tenant_id, created_at);

-- 2. Compound index on sync_events for multi-tenant delta syncs
ALTER TABLE public.sync_events
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS idx_sync_events_tenant_user_status
    ON public.sync_events(tenant_id, user_id, status);

-- 3. Guided Tour Definitions for Parent Portal (Grade Inspection & Chat Initiation)
DO $$
DECLARE
    v_grades_tutorial_id UUID;
    v_chat_tutorial_id UUID;
BEGIN
    -- 1. Resolve or create the PARENT:grades tutorial
    SELECT id INTO v_grades_tutorial_id
    FROM public.tutorials
    WHERE role = 'PARENT' AND screen_id = 'grades'
    LIMIT 1;

    IF v_grades_tutorial_id IS NULL THEN
        BEGIN
            INSERT INTO public.tutorials (id, role, screen_id, is_active)
            VALUES ('a0000000-0000-0000-0000-000000000007', 'PARENT', 'grades', true)
            RETURNING id INTO v_grades_tutorial_id;
        EXCEPTION WHEN unique_violation THEN
            SELECT id INTO v_grades_tutorial_id
            FROM public.tutorials
            WHERE role = 'PARENT' AND screen_id = 'grades'
            LIMIT 1;

            IF v_grades_tutorial_id IS NULL THEN
                INSERT INTO public.tutorials (id, role, screen_id, is_active)
                VALUES (gen_random_uuid(), 'PARENT', 'grades', true)
                ON CONFLICT (role, screen_id) DO UPDATE SET is_active = true
                RETURNING id INTO v_grades_tutorial_id;
            END IF;
        END;
    ELSE
        UPDATE public.tutorials SET is_active = true WHERE id = v_grades_tutorial_id;
    END IF;

    -- 2. Resolve or create the PARENT:chat_main tutorial
    SELECT id INTO v_chat_tutorial_id
    FROM public.tutorials
    WHERE role = 'PARENT' AND screen_id = 'chat_main'
    LIMIT 1;

    IF v_chat_tutorial_id IS NULL THEN
        BEGIN
            INSERT INTO public.tutorials (id, role, screen_id, is_active)
            VALUES ('a0000000-0000-0000-0000-000000000012', 'PARENT', 'chat_main', true)
            RETURNING id INTO v_chat_tutorial_id;
        EXCEPTION WHEN unique_violation THEN
            SELECT id INTO v_chat_tutorial_id
            FROM public.tutorials
            WHERE role = 'PARENT' AND screen_id = 'chat_main'
            LIMIT 1;

            IF v_chat_tutorial_id IS NULL THEN
                INSERT INTO public.tutorials (id, role, screen_id, is_active)
                VALUES (gen_random_uuid(), 'PARENT', 'chat_main', true)
                ON CONFLICT (role, screen_id) DO UPDATE SET is_active = true
                RETURNING id INTO v_chat_tutorial_id;
            END IF;
        END;
    ELSE
        UPDATE public.tutorials SET is_active = true WHERE id = v_chat_tutorial_id;
    END IF;

    -- 3. Steps for Parent Grades Inspection
    IF v_grades_tutorial_id IS NOT NULL THEN
        DELETE FROM public.tutorial_steps WHERE tutorial_id = v_grades_tutorial_id;

        INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
        VALUES
            (
                v_grades_tutorial_id,
                1,
                '#term-selector',
                'Inspect Academic Term',
                'අධ්‍යයන වාරය පරීක්ෂා කරන්න',
                'கல்வித் தவணையை ஆய்வு செய்க',
                'Switch between academic terms to review your child''s past and current exam performance.',
                'ඔබේ දරුවාගේ පසුගිය සහ වත්මන් විභාග කාර්ය සාධනය සමාලෝචනය කිරීමට අධ්‍යයන වාර අතර මාරු වන්න.',
                'உங்கள் குழந்தையின் கடந்த கால மற்றும் தற்போதைய தேர்வு செயல்திறனை மதிப்பாய்வு செய்ய கல்வித் தவணைகளுக்கு இடையில் மாறவும்.'
            ),
            (
                v_grades_tutorial_id,
                2,
                '#marks-table',
                'Subject Marks & Letter Grades',
                'විෂය ලකුණු සහ ශ්‍රේණි',
                'பாட மதிப்பெண்கள் மற்றும் தரங்கள்',
                'View detailed breakdowns of marks obtained per subject, along with official letter grades (A, B, C, S, W).',
                'නිල අකුරු ශ්‍රේණි (A, B, C, S, W) සමඟින් සෑම විෂයයකටම ලබාගත් ලකුණු පිළිබඳ සවිස්තරාත්මක වාර්තාව බලන්න.',
                'அதிகாரப்பூர்வ தரங்களுடன் (A, B, C, S, W) ஒவ்வொரு பாடத்திற்கும் பெற்ற மதிப்பெண்களின் விரிவான விவரங்களைக் காண்க.'
            ),
            (
                v_grades_tutorial_id,
                3,
                '#download-report-btn',
                'Download Official Report Card',
                'නිල වාර්තාපත බාගන්න',
                'உத்தியோகபூர்வ அறிக்கை அட்டையைப் பதிவிறக்கவும்',
                'Download certified PDF report cards once the school administration has finalized term marks.',
                'පාසල් පරිපාලනය වාර ලකුණු අවසන් කළ පසු සහතික කළ PDF වාර්තාපත් බාගත කරගන්න.',
                'பள்ளி நிர்வாகம் தவணை மதிப்பெண்களை இறுதி செய்ததும் சான்றளிக்கப்பட்ட PDF அறிக்கை அட்டைகளைப் பதிவிறக்கவும்.'
            );
    END IF;

    -- 4. Steps for Parent-Teacher Chat Initiation
    IF v_chat_tutorial_id IS NOT NULL THEN
        DELETE FROM public.tutorial_steps WHERE tutorial_id = v_chat_tutorial_id;

        INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
        VALUES
            (
                v_chat_tutorial_id,
                1,
                '#chat-conversation-list',
                'Teacher Conversations',
                'ගුරු සංවාද',
                'ஆசிரியர் உரையாடல்கள்',
                'View existing conversations with your children''s class teachers and subject instructors.',
                'ඔබේ දරුවන්ගේ පන්තිභාර ගුරුවරුන් සහ විෂය ගුරුවරුන් සමඟ පවතින සංවාද මෙතැනින් බලන්න.',
                'உங்கள் குழந்தைகளின் வகுப்பு ஆசிரியர்கள் மற்றும் பாட ஆசிரியர்களுடனான உரையாடல்களை இங்கே காண்க.'
            ),
            (
                v_chat_tutorial_id,
                2,
                '#chat-new-conversation',
                'Initiate Direct Chat',
                'සෘජු සංවාදයක් ආරම්භ කරන්න',
                'நேரடி உரையாடலைத் தொடங்கவும்',
                'Click the plus button to initiate a new direct chat message with an assigned teacher regarding attendance or academic queries.',
                'පැමිණීම හෝ අධ්‍යයන ගැටළු පිළිබඳව පවරා ඇති ගුරුවරයෙකු සමඟ නව සෘජු සංවාදයක් ආරම්භ කිරීමට මෙහි ක්ලික් කරන්න.',
                'வருகை அல்லது கல்வி வினவல்கள் தொடர்பாக ஒதுக்கப்பட்ட ஆசிரியருடன் புதிய நேரடி உரையாடலைத் தொடங்க பிளஸ் பொத்தானைக் கிளிக் செய்க.'
            ),
            (
                v_chat_tutorial_id,
                3,
                '#chat-message-input',
                'Compose Inquiry',
                'විමසුම ලියන්න',
                'வினவலை எழுதுக',
                'Send secure, audit-logged inquiries and receive immediate responses during school consultation hours.',
                'පාසල් උපදේශන වේලාවන් තුළ ආරක්ෂිත, විගණනය කළ හැකි විමසීම් යවා ක්ෂණික ප්‍රතිචාර ලබා ගන්න.',
                'பள்ளி ஆலோசனை நேரங்களில் பாதுகாப்பான வினவல்களை அனுப்பி உடனடி பதில்களைப் பெறுங்கள்.'
            );
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
