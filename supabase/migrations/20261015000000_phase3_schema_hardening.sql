-- =============================================================================
-- Migration: 20261015000000_phase3_schema_hardening.sql
-- Description:
--   1. Add deleted_at soft-delete tombstones across synced tables (S2 requirement).
--   2. Scope homework_submissions.client_uuid to (tenant_id, client_uuid) as UUID.
--   3. Derive papers.is_paired automatically from marking_scheme_url.
--   4. Add platform column to mobile_app_versions with per-platform tracking.
--   5. Universal set_updated_at_timestamp() trigger across synced tables.
--   6. Seed Phase 3 localized tutorials for Web, Mobile, and API.
-- =============================================================================

-- 1. Add deleted_at soft-delete tombstones to synced tables
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_attendance_deleted_at ON public.attendance (tenant_id, deleted_at);

ALTER TABLE public.homework_tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_homework_tasks_deleted_at ON public.homework_tasks (tenant_id, deleted_at);

ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_homework_submissions_deleted_at ON public.homework_submissions (tenant_id, deleted_at);

ALTER TABLE public.school_emergency_contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_deleted_at ON public.school_emergency_contacts (tenant_id, deleted_at);

ALTER TABLE public.school_shelters ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_shelters_deleted_at ON public.school_shelters (tenant_id, deleted_at);

ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at ON public.media_assets (tenant_id, deleted_at);

ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_papers_deleted_at ON public.papers (tenant_id, deleted_at);


-- 2. Scope homework_submissions.client_uuid to (tenant_id, client_uuid) as UUID
DO $$
BEGIN
    -- Drop global unique constraint on client_uuid if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'homework_submissions_client_uuid_key'
    ) THEN
        ALTER TABLE public.homework_submissions DROP CONSTRAINT homework_submissions_client_uuid_key;
    END IF;
END $$;

-- Convert client_uuid to UUID type if needed
ALTER TABLE public.homework_submissions ALTER COLUMN client_uuid TYPE UUID USING client_uuid::uuid;

-- Add tenant-scoped uniqueness
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_homework_submission_client_uuid'
    ) THEN
        ALTER TABLE public.homework_submissions
            ADD CONSTRAINT uq_homework_submission_client_uuid UNIQUE (tenant_id, client_uuid);
    END IF;
END $$;


-- 3. Derive papers.is_paired automatically from marking_scheme_url
ALTER TABLE public.papers DROP COLUMN IF EXISTS is_paired CASCADE;
ALTER TABLE public.papers ADD COLUMN is_paired BOOLEAN GENERATED ALWAYS AS (
    marking_scheme_url IS NOT NULL AND TRIM(marking_scheme_url) <> ''
) STORED;


-- 4. Add platform column to mobile_app_versions
ALTER TABLE public.mobile_app_versions ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'all'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_app_versions_platform ON public.mobile_app_versions (platform);

-- Seed default version entries for android and ios with valid RFC-4122 v4 UUIDs
INSERT INTO public.mobile_app_versions (id, platform, min_version, latest_version, release_notes, force_update)
VALUES
    ('c0a53aba-4e41-4173-a3c8-b6b720cfb139', 'android', '1.0.0', '1.0.0', 'EduLanka Android Phase 3 — Offline Sync & Video Streaming', false),
    ('b47d60b3-54a9-4e6f-90f2-bd15d44db9fe', 'ios', '1.0.0', '1.0.0', 'EduLanka iOS Phase 3 — Offline Sync & Video Streaming', false)
ON CONFLICT (platform) DO UPDATE SET
    updated_at = NOW();


-- 5. Universal set_updated_at_timestamp() trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger across all synced tables
DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_homework_tasks_updated_at ON public.homework_tasks;
CREATE TRIGGER trg_homework_tasks_updated_at
    BEFORE UPDATE ON public.homework_tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_homework_submissions_updated_at ON public.homework_submissions;
CREATE TRIGGER trg_homework_submissions_updated_at
    BEFORE UPDATE ON public.homework_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_media_assets_updated_at ON public.media_assets;
CREATE TRIGGER trg_media_assets_updated_at
    BEFORE UPDATE ON public.media_assets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_papers_updated_at ON public.papers;
CREATE TRIGGER trg_papers_updated_at
    BEFORE UPDATE ON public.papers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_emergency_contacts_updated_at ON public.school_emergency_contacts;
CREATE TRIGGER trg_emergency_contacts_updated_at
    BEFORE UPDATE ON public.school_emergency_contacts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_shelters_updated_at ON public.school_shelters;
CREATE TRIGGER trg_shelters_updated_at
    BEFORE UPDATE ON public.school_shelters
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_mobile_app_versions_updated_at ON public.mobile_app_versions;
CREATE TRIGGER trg_mobile_app_versions_updated_at
    BEFORE UPDATE ON public.mobile_app_versions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER trg_device_tokens_updated_at
    BEFORE UPDATE ON public.device_tokens
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 6. Seed Phase 3 Localized Tutorials (Media Hub, Paper Hub, Disaster Readiness)
-- Clean up legacy mock tutorial IDs if previously seeded
DELETE FROM public.tutorials WHERE id IN (
    'a0000000-0000-0000-0000-000000000020',
    'a0000000-0000-0000-0000-000000000021',
    'a0000000-0000-0000-0000-000000000022',
    'a0000000-0000-0000-0000-000000000023',
    'a0000000-0000-0000-0000-000000000024'
);

INSERT INTO public.tutorials (id, role, screen_id)
VALUES
    ('5b5d3122-c2cf-4f6e-92a0-a96668c67020', 'STUDENT', 'resources'),
    ('8431b32e-91bd-41eb-a1f3-34049438496a', 'TEACHER', 'resources'),
    ('b4c0266a-fd88-4634-93d8-62e258651c01', 'STUDENT', 'papers'),
    ('9238575a-a209-4432-b843-c42c1054f38d', 'TEACHER', 'papers'),
    ('7e2e6c16-2d25-405e-acb4-9ce754819a87', 'SCHOOL_ADMIN', 'disaster')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES
    -- Student Learning Resources
    ('5b5d3122-c2cf-4f6e-92a0-a96668c67020', 1, NULL, 'Learning Resources', 'ඉගෙනුම් සම්පත්', 'கற்றல் வளங்கள்', 'Welcome to the curriculum video library. Watch lessons with adaptive HLS streaming.', 'විෂයමාලා වීඩියෝ පුස්තකාලයට සාදරයෙන් පිළිගනිමු. අනුවර්තී HLS ප්‍රවාහය සමඟ පාඩම් නරඹන්න.', 'பாடத்திட்ட வீடியோ நூலகத்திற்கு வரவேற்கிறோம். தகவமைப்பு HLS ஸ்ட்ரீமிங்குடன் பாடங்களைக் காண்க.'),
    ('5b5d3122-c2cf-4f6e-92a0-a96668c67020', 2, '#download-offline-btn', 'Encrypted Offline Manifests', 'නොබැඳි බලපත්‍ර සුරැකීම', 'மறைக்கப்பட்ட ஆஃப்லைன் சேமிப்பு', 'Growth plan students can download encrypted video manifests for offline playback on mobile.', 'ග්‍රෝත් සැලැස්මේ සිසුන්ට ජංගම දුරකථනයෙන් නොබැඳිව නැරඹීම සඳහා ගුප්තකේතනය කළ වීඩියෝ බලපත්‍ර බාගත කළ හැක.', 'வளர்ச்சித் திட்ட மாணவர்கள் மொபைலில் ஆஃப்லைனில் இயக்க மறைக்கப்பட்ட வீடியோ உரிமங்களை பதிவிறக்கலாம்.'),

    -- Teacher Learning Resources
    ('8431b32e-91bd-41eb-a1f3-34049438496a', 1, NULL, 'Publish Video Lessons', 'වීඩියෝ පාඩම් ප්‍රකාශනය', 'வீடியோ பாடங்களை வெளியிடுங்கள்', 'Upload videos directly to Cloudinary with quota tracking and automated HLS transcoding.', 'ස්වයංක්‍රීය HLS ට්‍රාන්ස්කෝඩිං සමඟින් සෘජුවම ක්ලවුඩිනරි වෙත වීඩියෝ උඩුගත කරන්න.', 'ஒதுக்கீட்டு கண்காணிப்பு மற்றும் தானியங்கி HLS மாற்றத்துடன் கிளவுடினரிக்கு வீடியோக்களை நேரடியாக பதிவேற்றவும்.'),
    ('8431b32e-91bd-41eb-a1f3-34049438496a', 2, '#upload-resource-btn', 'Signed Direct Uploads', 'අත්සන් කළ සෘජු උඩුගත කිරීම්', 'கையொப்பமிடப்பட்ட நேரடி பதிவேற்றங்கள்', 'Initiate secure signed uploads with live progress tracking and format verification.', 'සජීවී ප්‍රගති ලුහුබැඳීම සමඟින් ආරක්ෂිත අත්සන් කළ උඩුගත කිරීම් ආරම්භ කරන්න.', 'நேரடி முன்னேற்ற கண்காணிப்புடன் பாதுகாப்பான கையொப்பமிடப்பட்ட பதிவேற்றங்களைத் தொடங்குங்கள்.'),

    -- Student Paper Hub
    ('b4c0266a-fd88-4634-93d8-62e258651c01', 1, NULL, 'National Past Paper Hub', 'ජාතික පසුගිය විභාග ප්‍රශ්න පත්‍ර', 'தேசிய கடந்தகால வினாத்தாள்கள்', 'Access Sri Lankan G.C.E. O/L, A/L and Grade 5 Scholarship papers in Sinhala, Tamil, and English.', 'සිංහල, දෙමළ සහ ඉංග්‍රීසි මාධ්‍යයෙන් ශ්‍රී ලංකා අ.පො.ස. සා/පෙළ, උ/පෙළ සහ 5 ශ්‍රේණියේ ශිෂ්‍යත්ව ප්‍රශ්න පත්‍ර ලබා ගන්න.', 'சிங்களம், தமிழ் மற்றும் ஆங்கிலத்தில் இலங்கை க.பொ.த சாதாரண, உயர்தர மற்றும் தரம் 5 புலமைப்பரிசில் தாள்களை அணுகவும்.'),
    ('b4c0266a-fd88-4634-93d8-62e258651c01', 2, '#marking-scheme-split', 'Paired Marking Schemes', 'ලකුණු ලබා දීමේ පටිපාටිය', 'இணைக்கப்பட்ட புள்ளித்திட்டம்', 'View exam questions and official marking schemes side-by-side with synchronized zoom.', 'ප්‍රශ්න සහ නිල ලකුණු ලබා දීමේ පටිපාටිය එකවර තිරයේ දෙපසින් නරඹන්න.', 'வினாக்கள் மற்றும் உத்தியோகபூர்வ புள்ளித்திட்டங்களை அருகருகே ஒத்திசைக்கப்பட்ட பெரிதாக்கலுடன் காண்க.'),

    -- Teacher Paper Hub
    ('9238575a-a209-4432-b843-c42c1054f38d', 1, NULL, 'Publish Past Papers', 'ප්‍රශ්න පත්‍ර එක් කරන්න', 'கடந்தகால தாள்களைப் பதிவேற்றவும்', 'Upload institutional term test papers or national past papers with automated marking scheme pairing.', 'ස්වයංක්‍රීය ලකුණු ලබා දීමේ පටිපාටි යුගල කිරීම සමඟ වාර විභාග හෝ ජාතික ප්‍රශ්න පත්‍ර උඩුගත කරන්න.', 'தானியங்கி புள்ளித்திட்ட இணைப்புடன் தவணைத் தேர்வு அல்லது தேசிய கடந்தகால தாள்களைப் பதிவேற்றவும்.'),

    -- School Admin Disaster Readiness
    ('7e2e6c16-2d25-405e-acb4-9ce754819a87', 1, NULL, 'Disaster Readiness Hub', 'ආපදා සූදානම කළමනාකරණය', 'பேரிடர் தயார்நிலை மையம்', 'Configure school emergency contacts and local evacuation shelters to prepare offline packs.', 'නොබැඳි ඇසුරුම් සූදානම් කිරීම සඳහා පාසල් හදිසි සම්බන්ධතා සහ ප්‍රාදේශීය ආපදා නවාතැන් වින්‍යාස කරන්න.', 'ஆஃப்லைன் பொதிகளைத் தயாரிக்க பள்ளி அவசர தொடர்புகள் மற்றும் உள்ளூர் வெளியேற்ற முகாம்களை உள்ளமைக்கவும்.'),
    ('7e2e6c16-2d25-405e-acb4-9ce754819a87', 2, '#broadcast-disaster-btn', 'Emergency Broadcast Trigger', 'හදිසි ආපදා විකාශනය', 'அவசர ஒளிபரப்பு தூண்டுதல்', 'Dispatch high-priority push notifications and generate offline disaster packs for students and parents.', 'සිසුන් සහ දෙමාපියන් සඳහා අධි-ප්‍රමුඛතා දැනුම්දීම් යවා නොබැඳි ආපදා ඇසුරුම් සූදානම් කරන්න.', 'மாணவர்கள் மற்றும் பெற்றோருக்கான அவசர அறிவிப்புகளை அனுப்பி ஆஃப்லைன் பேரிடர் பொதிகளை உருவாக்கவும்.')
ON CONFLICT (tutorial_id, step_order) DO NOTHING;

NOTIFY pgrst, 'reload schema';
