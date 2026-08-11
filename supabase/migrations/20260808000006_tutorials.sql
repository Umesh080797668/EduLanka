-- =============================================================================
-- Migration: 20260808000006_tutorials.sql
-- Description: Implement central tutorial-content store and per-user completion tracking.
-- =============================================================================

-- =============================================================================
-- 1. Create global tutorial config tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,         -- e.g., 'STUDENT', 'TEACHER', 'PARENT', 'SCHOOL_ADMIN'
    screen_id TEXT NOT NULL,    -- e.g., 'dashboard', 'grades'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(role, screen_id)
);

CREATE TABLE IF NOT EXISTS public.tutorial_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutorial_id UUID NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    target_element TEXT,        -- CSS selector, nullable for centered modals
    title_en TEXT NOT NULL,
    title_si TEXT,
    title_ta TEXT,
    content_en TEXT NOT NULL,
    content_si TEXT,
    content_ta TEXT,
    media_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tutorial_id, step_order)
);

-- RLS & Policies
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_steps ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (of any role) to READ active tutorials
DROP POLICY IF EXISTS "auth_read_tutorials" ON public.tutorials;
CREATE POLICY "auth_read_tutorials" ON public.tutorials
    FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

DROP POLICY IF EXISTS "auth_read_tutorial_steps" ON public.tutorial_steps;
CREATE POLICY "auth_read_tutorial_steps" ON public.tutorial_steps
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role bypass
DROP POLICY IF EXISTS "service_all_tutorials" ON public.tutorials;
CREATE POLICY "service_all_tutorials" ON public.tutorials USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_all_steps" ON public.tutorial_steps;
CREATE POLICY "service_all_steps" ON public.tutorial_steps USING (true) WITH CHECK (true);

-- Updated At triggers
DROP TRIGGER IF EXISTS tutorials_updated_at ON public.tutorials;
CREATE TRIGGER tutorials_updated_at BEFORE UPDATE ON public.tutorials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. Apply script: add user_tutorials to a tenant
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_sprint6_to_tenant(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_schema TEXT;
BEGIN
    v_schema := 'tenant_' || p_slug;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = v_schema AND table_name = 'user_tutorials'
    ) THEN
        EXECUTE format('
            CREATE TABLE %I.user_tutorials (
                id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id         UUID        NOT NULL REFERENCES %I.users(id) ON DELETE CASCADE,
                tutorial_id     UUID        NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
                status          TEXT        NOT NULL CHECK (status IN (''COMPLETED'', ''SKIPPED'')),
                completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, tutorial_id)
            )', v_schema, v_schema);

        EXECUTE format('ALTER TABLE %I.user_tutorials ENABLE ROW LEVEL SECURITY', v_schema);
        EXECUTE format('CREATE POLICY "service_role_all" ON %I.user_tutorials USING (true) WITH CHECK (true)', v_schema);
        
        -- Users can only read their own tracking
        EXECUTE format('
            CREATE POLICY "user_read_own_tutorials" ON %I.user_tutorials
            FOR SELECT USING (
                user_id IN (SELECT id FROM %I.users WHERE user_id = auth.uid())
            )', v_schema, v_schema);
            
        -- School Admins can read aggregate completions
        EXECUTE format('
            CREATE POLICY "admin_read_all_tutorials" ON %I.user_tutorials
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM %I.users u
                    WHERE u.user_id = auth.uid() AND u.role = ''SCHOOL_ADMIN''
                )
            )', v_schema, v_schema);

        EXECUTE format('CREATE INDEX idx_user_tutorials_user_id ON %I.user_tutorials(user_id)', v_schema);
        EXECUTE format('CREATE INDEX idx_user_tutorials_tutorial_id ON %I.user_tutorials(tutorial_id)', v_schema);
    END IF;

    RAISE NOTICE 'Sprint 6 schema (user tutorials) applied to tenant %', p_slug;
END;
$$;

-- Apply to all existing tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT slug FROM public.tenants WHERE status = 'ACTIVE'
    LOOP
        PERFORM public.apply_sprint6_to_tenant(t.slug);
    END LOOP;
END;
$$;

-- =============================================================================
-- 3. Modify create_tenant_schema directly to include Sprint 6
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema_sprint6_override(p_slug TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Run core setup + Sprint 4
    PERFORM public.create_tenant_schema_sprint4_override(p_slug);
    
    -- 2. Run new sprint 6 migrations for the schema
    PERFORM public.apply_sprint6_to_tenant(p_slug);
END;
$$;

-- Seed Basic Tutorials (Admin / Student / Teacher / Parent)
INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'STUDENT', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000002', 'TEACHER', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000003', 'SCHOOL_ADMIN', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000004', 'PARENT', 'dashboard'),
    ('a0000000-0000-0000-0000-000000000005', 'STUDENT', 'grades'),
    ('a0000000-0000-0000-0000-000000000006', 'TEACHER', 'grades'),
    ('a0000000-0000-0000-0000-000000000007', 'PARENT', 'grades'),
    ('a0000000-0000-0000-0000-000000000008', 'SCHOOL_ADMIN', 'users'),
    ('a0000000-0000-0000-0000-000000000009', 'SCHOOL_ADMIN', 'policy'),
    ('a0000000-0000-0000-0000-000000000010', 'SUPER_ADMIN', 'dashboard')
ON CONFLICT DO NOTHING;

INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 1, '#nav-grades', 'My Grades', 'මගේ ශ්‍රේණි', 'எனது தரங்கள்', 'Click here to view your report cards and specific subject marks.', 'ඔබගේ වාර්තාපත් සහ නිශ්චිත විෂය ලකුණු බැලීමට මෙහි ක්ලික් කරන්න.', 'உங்கள் அறிக்கை அட்டைகள் மற்றும் குறிப்பிட்ட பாட மதிப்பெண்களை காண இங்கே கிளிக் செய்யவும்.'),
    ('a0000000-0000-0000-0000-000000000001', 2, '#nav-dashboard', 'Dashboard overview', 'උපකරණ පුවරු දළ විශ්ලේෂණය', 'முகப்பு கண்ணோட்டம்', 'This is your dashboard which summarizes your latest activities.', 'මෙය ඔබගේ නවතම ක්‍රියාකාරකම් සාරාංශ කරන ඔබගේ උපකරණ පුවරුවයි.', 'இது உங்கள் சமீபத்திய செயல்பாடுகளை சுருக்கமாகக் காட்டும் உங்கள் முகப்பு.'),
    
    ('a0000000-0000-0000-0000-000000000002', 1, '#nav-classes', 'Your Classes', 'ඔබගේ පන්ති', 'உங்கள் வகுப்புகள்', 'Manage your assigned classes and record attendance here.', 'ඔබට පවරා ඇති පන්ති කළමනාකරණය කර මෙහි පැමිණීම සටහන් කරන්න.', 'உங்களுக்கு ஒதுக்கப்பட்ட வகுப்புகளை நிர்வகிக்கவும், வருகையை இங்கே பதிவு செய்யவும்.'),
    ('a0000000-0000-0000-0000-000000000002', 2, '#nav-gradebook', 'Enter Marks', 'ලකුණු ඇතුළත් කරන්න', 'மதிப்பெண்களை உள்ளிடவும்', 'Use the Gradebook to quickly record student marks per term.', 'වාරයකට සිසුන්ගේ ලකුණු ඉක්මනින් සටහන් කිරීමට ශ්‍රේණි පොත භාවිතා කරන්න.', 'ஒவ்வொரு தவணைக்கும் மாணவர் மதிப்பெண்களை விரைவாகப் பதிவு செய்ய கிரேடுபுகைப் பயன்படுத்தவும்.'),

    ('a0000000-0000-0000-0000-000000000003', 1, '#nav-users', 'Manage Accounts', 'ගිණුම් කළමනාකරණය', 'கணக்குகளை நிர்வகி', 'From here, you can enroll students, unenroll via transfer, and manage teacher accounts.', 'මෙහි සිට, ඔබට සිසුන් ලියාපදිංචි කිරීමට, මාරුවීම් හරහා ඉවත් කිරීමට සහ ගුරුවරුන්ගේ ගිණුම් කළමනාකරණය කිරීමට හැකිය.', 'இங்கிருந்து, நீங்கள் மாணவர்களை சேர்க்கலாம், இடமாற்றம் மூலம் வெளியேற்றலாம் மற்றும் ஆசிரியர் கணக்குகளை நிர்வகிக்கலாம்.'),
    ('a0000000-0000-0000-0000-000000000003', 2, '#nav-policies', 'Policies', 'ප්‍රතිපත්ති', 'கொள்கைகள்', 'Configure school-wide policies and feature limits.', 'පාසල් මට්ටමේ ප්‍රතිපත්ති සහ විශේෂාංග සීමාවන් වින්‍යාස කරන්න.', 'பள்ளி அளவிலான கொள்கைகள் மற்றும் அம்ச வரம்புகளை உள்ளமைக்கவும்.'),

    ('a0000000-0000-0000-0000-000000000004', 1, '#nav-dashboard', 'Welcome Parent', 'මව්පියන් පිළිගනිමු', 'பெற்றோரை வரவேற்கிறோம்', 'Track your child''s progress from this main dashboard.', 'මෙම ප්‍රධාන උපකරණ පුවරුවෙන් ඔබේ දරුවාගේ ප්‍රගතිය නිරීක්ෂණය කරන්න.', 'இந்த பிரதான முகப்பிலிருந்து உங்கள் குழந்தையின் முன்னேற்றத்தை கண்காணிக்கவும்.'),
    
    ('a0000000-0000-0000-0000-000000000005', 1, NULL, 'Academic Performance', 'අධ්‍යයන කාර්ය සාධනය', 'கல்வி செயல்திறன்', 'Welcome to your Grades dashboard. Here you can track your academic progress across all terms.', 'ඔබගේ ශ්‍රේණි උපකරණ පුවරුවට සාදරයෙන් පිළිගනිමු. මෙහිදී ඔබට සියලුම වාර හරහා ඔබගේ අධ්‍යයන ප්‍රගතිය නිරීක්ෂණය කළ හැක.', 'உங்கள் தரங்கள் முகப்புக்கு வரவேற்கிறோம். இங்கு எல்லா தவணைகளிலும் உங்கள் கல்வி முன்னேற்றத்தைக் கண்காணிக்கலாம்.'),
    ('a0000000-0000-0000-0000-000000000005', 2, '#term-selector', 'Select Term', 'වාරය තෝරන්න', 'தவணையைத் தேர்ந்தெடுக்கவும்', 'Use this dropdown to view previous term marks.', 'පෙර වාරයේ ලකුණු බැලීමට මෙය භාවිතා කරන්න.', 'முந்தைய தவணை மதிப்பெண்களைக் காண இதனைப் பயன்படுத்தவும்.'),
    ('a0000000-0000-0000-0000-000000000005', 3, '#download-report-btn', 'Download Report Card', 'වාර්තාපත බාගන්න', 'அறிக்கை அட்டையைப் பதிவிறக்கவும்', 'Once the term is finalized, you can download your official PDF report card here.', 'වාරය අවසන් වූ පසු, ඔබට ඔබගේ නිල PDF වාර්තාපත මෙතැනින් බාගත හැක.', 'தவணை முடிந்ததும், உத்தியோகபூர்வ PDF அறிக்கை அட்டையை இங்கிருந்து பதிவிறக்கலாம்.'),

    ('a0000000-0000-0000-0000-000000000006', 1, NULL, 'Grade Entry Mode', 'ලකුණු ඇතුළත් කිරීමේ ප්‍රකාරය', 'மதிப்பெண் உள்ளிடும் முறை', 'Welcome to the grade entry system. Please ensure you have the correct class selected.', 'ලකුණු ඇතුළත් කිරීමේ පද්ධතියට සාදරයෙන් පිළිගනිමු. කරුණාකර ඔබ නිවැරදි පන්තිය තෝරාගෙන ඇති බවට සහතික වන්න.', 'மதிப்பெண் உள்ளீட்டு முறைமைக்கு வரவேற்கிறோம். சரியான வகுப்பைத் தேர்ந்தெடுத்துள்ளீர்களா என்பதை உறுதிப்படுத்தவும்.'),
    ('a0000000-0000-0000-0000-000000000006', 2, '#subject-selector', 'Select Subject', 'විෂය තෝරන්න', 'பாடத்தைத் தேர்ந்தெடுக்கவும்', 'Choose the subject you are grading for this class session.', 'මෙම පන්ති සැසිය සඳහා ඔබ ලකුණු ලබා දෙන විෂය තෝරන්න.', 'இந்த வகுப்பு அமர்வுக்கு நீங்கள் மதிப்பெண் வழங்கும் பாடத்தைத் தேர்ந்தெடுக்கவும்.'),
    ('a0000000-0000-0000-0000-000000000006', 3, '#marks-table', 'Input Marks', 'ලකුණු ඇතුළත් කරන්න', 'மதிப்பெண்களை உள்ளிடவும்', 'Enter the student marks here. Changes are saved automatically.', 'මෙතැන සිසුන්ගේ ලකුණු ඇතුළත් කරන්න. වෙනස්කම් ස්වයංක්‍රීයව සුරැකේ.', 'மாணவர் மதிப்பெண்களை இங்கே உள்ளிடவும். மாற்றங்கள் தானாகவே சேமிக்கப்படும்.'),
    ('a0000000-0000-0000-0000-000000000006', 4, '#finalize-term-btn', 'Finalize Term', 'වාරය අවසන් කරන්න', 'தவணையை முடிவு செய்', 'Once all marks are entered, click here to finalize the term. Note: this cannot be undone!', 'සියලුම ලකුණු ඇතුළත් කළ පසු, වාරය අවසන් කිරීමට මෙහි ක්ලික් කරන්න. සටහන: මෙය ආපසු හැරවිය නොහැක!', 'அனைத்து மதிப்பெண்களும் உள்ளிடப்பட்டதும், தவணையை முடிக்க இங்கே கிளிக் செய்யவும். குறிப்பு: இதை மாற்ற முடியாது!'),

    ('a0000000-0000-0000-0000-000000000007', 1, NULL, 'Student Progress', 'ශිෂ්‍ය ප්‍රගතිය', 'மாணவர் முன்னேற்றம்', 'Track your child''s academic progress through this dashboard.', 'මෙම උපකරණ පුවරුව හරහා ඔබේ දරුවාගේ අධ්‍යයන ප්‍රගතිය නිරීක්ෂණය කරන්න.', 'இந்த முகப்பு மூலம் உங்கள் குழந்தையின் கல்வி முன்னேற்றத்தைக் கண்காணிக்கவும்.'),
    ('a0000000-0000-0000-0000-000000000007', 2, '#term-selector', 'Select Term', 'වාරය තෝරන්න', 'தவணையைத் தேர்ந்தெடுக்கவும்', 'View historical marks for previous academic terms.', 'පෙර අධ්‍යයන වාර සඳහා ඓතිහාසික ලකුණු බලන්න.', 'முந்தைய கல்வித் தவணைகளுக்கான வரலாற்று மதிப்பெண்களைக் காண்க.'),
    ('a0000000-0000-0000-0000-000000000007', 3, '#download-report-btn', 'Generate Report Card', 'වාර්තාපත උත්පාදනය කරන්න', 'அறிக்கை அட்டையை உருவாக்கு', 'Download the official digital report card for official records.', 'නිල වාර්තා සඳහා නිල ඩිජිටල් වාර්තාපත බාගන්න.', 'உத்தியோகபூர்வ பதிவுகளுக்காக உத்தியோகபூர்வ டிஜிட்டல் அறிக்கை அட்டையைப் பதிவிறக்கவும்.'),

    ('a0000000-0000-0000-0000-000000000008', 1, NULL, 'Account Management', 'ගිණුම් කළමනාකරණය', 'கணக்குகளை நிர்வகி', 'This is the master directory to manage all users within your institution.', 'ඔබගේ ආයතනය තුළ සිටින සියලුම පරිශීලකයින් කළමනාකරණය කිරීම සඳහා ප්‍රධාන නාමාවලිය මෙයයි.', 'உங்கள் நிறுவனத்திற்குள் அனைத்து பயனர்களையும் நிர்வகிப்பதற்கான பிரதான கோப்பகம் இதுவாகும்.'),
    ('a0000000-0000-0000-0000-000000000008', 2, '#add-user-btn', 'Enroll New Users', 'නව පරිශීලකයින් ලියාපදිංචි කරන්න', 'புதிய பயனர்களைச் சேர்', 'Click here to manually enroll students, teachers, or parents individually.', 'සිසුන්, ගුරුවරුන් හෝ දෙමාපියන් තනි තනිව ලියාපදිංචි කිරීමට මෙහි ක්ලික් කරන්න.', 'மாணவர்கள், ஆசிரியர்கள் அல்லது பெற்றோரை தனித்தனியாக சேர்க்க இங்கே கிளிக் செய்யவும்.'),
    ('a0000000-0000-0000-0000-000000000008', 3, '#bulk-import-btn', 'Bulk Migration', 'තොග සංක්‍රමණය', 'மொத்த இடமாற்றம்', 'Use the CSV importer to onboard hundreds of students or teachers at once.', 'එකවර සිසුන් හෝ ගුරුවරුන් සිය ගණනක් බඳවා ගැනීමට CSV ආනයනකරු භාවිතා කරන්න.', 'ஒரே நேரத்தில் நூற்றுக்கணக்கான மாணவர்களை அல்லது ஆசிரியர்களை சேர்க்க CSV இறக்குமதியாளரைப் பயன்படுத்தவும்.'),
    ('a0000000-0000-0000-0000-000000000008', 4, '#user-status-toggle', 'Account Status', 'ගිණුමේ තත්ත්වය', 'கணக்கு நிலை', 'You can suspend or deactivate users who are transferring out of the institution.', 'ආයතනයෙන් මාරු වී යන පරිශීලකයින් අත්හිටුවීමට හෝ අක්‍රිය කිරීමට ඔබට හැකිය.', 'நிறுவனத்தை விட்டு வெளியேறும் பயனர்களை நீங்கள் இடைநிறுத்தலாம் அல்லது செயலிழக்கச் செய்யலாம்.'),

    ('a0000000-0000-0000-0000-000000000009', 1, NULL, 'System Policies', 'පද්ධති ප්‍රතිපත්ති', 'கணினி கொள்கைகள்', 'Manage global configurations and core settings for your school.', 'ඔබේ පාසල සඳහා ගෝලීය වින්‍යාසයන් සහ මූලික සැකසුම් කළමනාකරණය කරන්න.', 'உங்கள் பள்ளிக்கான உலகளாவிய உள்ளமைவுகள் மற்றும் அடிப்படை அமைப்புகளை நிர்வகிக்கவும்.'),
    ('a0000000-0000-0000-0000-000000000009', 2, '#grading-interval-setting', 'Grading Calendar', 'ශ්‍රේණිගත කිරීමේ දින දර්ශනය', 'மதிப்பெண் நாட்காட்டி', 'Define your term structures (e.g., 3 terms vs 4 terms) and exam periods.', 'ඔබේ වාර ව්‍යුහයන් සහ විභාග කාල සීමාවන් නිර්වචනය කරන්න.', 'உங்கள் தவணை அமைப்புகள் மற்றும் தேர்வு காலங்களை விளக்கவும்.'),
    ('a0000000-0000-0000-0000-000000000009', 3, '#tenant-limits', 'Feature Quotas', 'විශේෂාංග කෝටාවන්', 'அம்ச ஒதுக்கீடுகள்', 'Review your current plan limits and capacity usage.', 'ඔබගේ වත්මන් සැලැස්මේ සීමාවන් සහ ධාරිතා භාවිතය සමාලෝචනය කරන්න.', 'உங்கள் தற்போதைய திட்ட வரம்புகள் மற்றும் திறன் பயன்பாட்டை மதிப்பாய்வு செய்யவும்.'),

    ('a0000000-0000-0000-0000-000000000010', 1, NULL, 'System Administration', NULL, NULL, 'Welcome to the global System Admin dashboard.', NULL, NULL),
    ('a0000000-0000-0000-0000-000000000010', 2, '#nav-tenants', 'Manage Tenants', NULL, NULL, 'From here you can provision new schools and assign their subscription plans.', NULL, NULL),
    ('a0000000-0000-0000-0000-000000000010', 3, '#nav-infrastructure', 'System Health', NULL, NULL, 'Monitor the global health of the Nginx gateways, API servers, and Database.', NULL, NULL)
ON CONFLICT DO NOTHING;
