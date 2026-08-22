-- =============================================================================
-- Migration: 20260826000000_tutorial_target_fixes.sql
-- Description: Repair guided-tour coverage for Phase 1 & 2.
--   * Chat tour: retarget bare tag selectors ('aside'/'footer') at the stable
--     element ids, and add a dedicated step explaining how to START a
--     conversation via the "+" button (previously undocumented).
--   * Notices tour: retarget the fragile 'form select:first-of-type' selector at
--     the stable #notice-scope id.
--   * Disaster / telemetry coach-marks: backfill Sinhala & Tamil (tri-lingual is
--     a Phase-2 requirement) and replace the jargon-heavy English copy with
--     clear, parent-facing wording.
-- Every statement is keyed on stable columns and guarded with ON CONFLICT, so
-- the migration is safe to run more than once.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Chat tour  (tutorial c0000000-0000-0000-0000-000000000001, GENERAL/chat_main)
-- ─────────────────────────────────────────────────────────────────────────────

-- Conversations list: anchor to the stable id and reword to describe browsing
-- EXISTING threads — starting a new one becomes its own step below. Keyed on the
-- immutable title so re-runs are no-ops regardless of the current step order.
UPDATE public.tutorial_steps
SET target_element = '#chat-conversation-list',
    step_order     = 2,
    content_en = 'All your class groups and direct chats live in this sidebar. Tap any one to open the conversation.',
    content_si = 'ඔබගේ සියලුම පන්ති කණ්ඩායම් සහ සෘජු චැට් මෙම පැති තීරුවේ ඇත. සංවාදයක් විවෘත කිරීමට ඕනෑම එකක් තට්ටු කරන්න.',
    content_ta = 'உங்கள் அனைத்து வகுப்புக் குழுக்களும் நேரடி அரட்டைகளும் இந்தப் பக்கப்பட்டியில் உள்ளன. உரையாடலைத் திறக்க எதையேனும் தட்டவும்.'
WHERE tutorial_id = 'c0000000-0000-0000-0000-000000000001'
  AND title_en = 'Conversations List';

-- Composer: anchor to the stable id and move to the end (order 4) so the new
-- "start a conversation" step can take order 3. Runs before the INSERT below.
UPDATE public.tutorial_steps
SET target_element = '#chat-composer',
    step_order     = 4
WHERE tutorial_id = 'c0000000-0000-0000-0000-000000000001'
  AND title_en = 'Send Messages & Read Receipts';

-- New step 3: how to actually START a chat — the exact question users hit.
INSERT INTO public.tutorial_steps
    (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    3,
    '#chat-new-conversation',
    'Start a New Conversation',
    'නව සංවාදයක් අරඹන්න',
    'புதிய உரையாடலைத் தொடங்கவும்',
    'Click the + button to start a new chat. Choose one person for a direct message, or add several people to create a group conversation.',
    '+ බොත්තම ක්ලික් කර නව චැට් එකක් අරඹන්න. සෘජු පණිවිඩයක් සඳහා එක් අයෙකු තෝරන්න, නැතහොත් කණ්ඩායම් සංවාදයක් සෑදීමට කිහිප දෙනෙකු එක් කරන්න.',
    '+ பொத்தானைக் கிளிக் செய்து புதிய அரட்டையைத் தொடங்கவும். நேரடிச் செய்திக்கு ஒருவரைத் தேர்ந்தெடுக்கவும், அல்லது குழு உரையாடலை உருவாக்க பலரைச் சேர்க்கவும்.'
)
ON CONFLICT (tutorial_id, step_order) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Notices tour  (tutorial b9999999-…, SCHOOL_ADMIN/notices)
-- ─────────────────────────────────────────────────────────────────────────────

-- 'form select:first-of-type' is brittle (breaks the moment the form gains
-- another select); the scope dropdown has a stable id.
UPDATE public.tutorial_steps
SET target_element = '#notice-scope'
WHERE tutorial_id = 'b9999999-9999-9999-9999-999999999999'
  AND target_element = 'form select:first-of-type';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Disaster-mode coach-mark — SCHOOL_ADMIN/dashboard (step_order 99)
--    tri-lingual backfill + clearer copy. Keyed on the stable target id.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.tutorial_steps
SET title_en   = 'Disaster Mode',
    title_si   = 'ව්‍යසන ප්‍රකාරය',
    title_ta   = 'பேரிடர் நிலை',
    content_en = 'Activating Disaster Mode instantly sends an emergency SMS to every parent in your school and switches the platform to an offline-safe state. Use it only for genuine emergencies such as sudden closures.',
    content_si = 'ව්‍යසන ප්‍රකාරය සක්‍රිය කිරීමෙන් ඔබේ පාසලේ සෑම මව්පියෙකුටම හදිසි SMS පණිවිඩයක් ක්ෂණිකව යවා වේදිකාව නොබැඳි-ආරක්ෂිත තත්ත්වයට මාරු කරයි. හදිසි වැසීම් වැනි සැබෑ හදිසි අවස්ථාවලදී පමණක් එය භාවිතා කරන්න.',
    content_ta = 'பேரிடர் நிலையை இயக்கினால், உங்கள் பள்ளியில் உள்ள ஒவ்வொரு பெற்றோருக்கும் அவசர SMS உடனடியாக அனுப்பப்பட்டு, தளம் ஆஃப்லைன்-பாதுகாப்பு நிலைக்கு மாறும். திடீர் மூடல்கள் போன்ற உண்மையான அவசரநிலைகளுக்கு மட்டுமே இதைப் பயன்படுத்தவும்.'
WHERE target_element = '#disaster-mode-quick-action'
  AND step_order = 99;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Emergency-receipts coach-mark — PARENT/dashboard (step_order 99)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.tutorial_steps
SET title_en   = 'Emergency Alerts',
    title_si   = 'හදිසි ඇඟවීම්',
    title_ta   = 'அவசர எச்சரிக்கைகள்',
    content_en = 'If your school activates Disaster Mode, an urgent SMS is sent straight to your registered phone — even if the app is closed. The full announcement also appears here in your notices.',
    content_si = 'ඔබේ පාසල ව්‍යසන ප්‍රකාරය සක්‍රිය කළහොත්, යෙදුම වසා තිබුණත්, හදිසි SMS පණිවිඩයක් ඔබේ ලියාපදිංචි දුරකථනයට කෙලින්ම යැවේ. සම්පූර්ණ නිවේදනය ඔබේ නිවේදන අතර මෙහිද දිස්වේ.',
    content_ta = 'உங்கள் பள்ளி பேரிடர் நிலையை இயக்கினால், செயலி மூடப்பட்டிருந்தாலும், அவசர SMS நேரடியாக உங்கள் பதிவுசெய்யப்பட்ட தொலைபேசிக்கு அனுப்பப்படும். முழு அறிவிப்பும் இங்கே உங்கள் அறிவிப்புகளில் தோன்றும்.'
WHERE tutorial_id = (
        SELECT id FROM public.tutorials
        WHERE role = 'PARENT' AND screen_id = 'dashboard'
    )
  AND step_order = 99;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Telemetry coach-mark — SUPER_ADMIN/dashboard (step_order 99)
--    Targets #nav-dashboard which repeats across tours, so scope by tutorial.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.tutorial_steps
SET title_en   = 'Live Platform Telemetry',
    title_si   = 'තත්‍ය කාලීන වේදිකා ටෙලිමිතිය',
    title_ta   = 'நேரடி தள தொலைஅளவீடு',
    content_en = 'This dashboard streams real-time WebSocket connections and global presence metrics from every connected school, so you can monitor platform health at a glance.',
    content_si = 'මෙම උපකරණ පුවරුව සම්බන්ධිත සෑම පාසලකින්ම තත්‍ය කාලීන WebSocket සම්බන්ධතා සහ ගෝලීය පැමිණීමේ මිතික ප්‍රවාහනය කරයි, එමඟින් ඔබට වේදිකාවේ සෞඛ්‍යය එක් බැල්මකින් නිරීක්ෂණය කළ හැක.',
    content_ta = 'இந்த முகப்பு, இணைக்கப்பட்ட ஒவ்வொரு பள்ளியிலிருந்தும் நேரடி WebSocket இணைப்புகள் மற்றும் உலகளாவிய இருப்பு அளவீடுகளை ஒளிபரப்புகிறது, இதனால் தளத்தின் நலனை ஒரே பார்வையில் கண்காணிக்கலாம்.'
WHERE tutorial_id = (
        SELECT id FROM public.tutorials
        WHERE role = 'SUPER_ADMIN' AND screen_id = 'dashboard'
    )
  AND step_order = 99;
