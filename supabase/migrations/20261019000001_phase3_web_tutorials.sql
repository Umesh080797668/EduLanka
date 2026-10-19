-- =============================================================================
-- Migration: 20261019000001_phase3_web_tutorials.sql
-- Description:
-- Seeds missing localized web tutorials for Phase 3 screens:
--   - blogs (TEACHER, STUDENT, SCHOOL_ADMIN)
--   - attendance (TEACHER)
--   - homework (TEACHER)
--   - sync_health (SCHOOL_ADMIN)
-- Provides multi-lingual translations (en, si, ta) and valid target element IDs.
-- =============================================================================

INSERT INTO public.tutorials (id, role, screen_id)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'TEACHER', 'blogs'),
    ('b0000000-0000-0000-0000-000000000002', 'STUDENT', 'blogs'),
    ('b0000000-0000-0000-0000-000000000003', 'SCHOOL_ADMIN', 'blogs'),
    ('b0000000-0000-0000-0000-000000000004', 'TEACHER', 'attendance'),
    ('b0000000-0000-0000-0000-000000000005', 'TEACHER', 'homework'),
    ('b0000000-0000-0000-0000-000000000006', 'SCHOOL_ADMIN', 'sync_health')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES
    -- 1. Teacher Blogs
    ('b0000000-0000-0000-0000-000000000001', 1, NULL,
     'Educational Blogs', 'අධ්‍යාපනික බ්ලොග් අඩවි', 'கல்வி வலைப்பதிவுகள்',
     'Welcome to the educational blog network. Author pedagogical articles, lesson guides, and exam strategies.',
     'අධ්‍යාපනික බ්ලොග් ජාලයට සාදරයෙන් පිළිගනිමු. ඉගැන්වීම් ලිපි, පාඩම් මාර්ගෝපදේශ සහ විභාග උපාය මාර්ග ලියන්න.',
     'கல்வி வலைப்பதிவு வலையமைப்பிற்கு வரவேற்கிறோம். கற்பித்தல் கட்டுரைகள், பாட வழிகாட்டிகள் மற்றும் தேர்வு உத்திகளை எழுதுங்கள்.'),
    ('b0000000-0000-0000-0000-000000000001', 2, '#btn-author-article',
     'Draft New Article', 'නව ලිපියක් ලියන්න', 'புதிய கட்டுரையை எழுதுங்கள்',
     'Write rich Markdown articles, attach lesson notes, and upload custom cover banners.',
     'Markdown හැඩසවිකරණය සමඟ ලිපි ලියන්න, පාඩම් සටහන් අමුණන්න සහ ආවරණ පින්තූර එක් කරන්න.',
     'Markdown வடிவமைப்புடன் கட்டுரைகளை எழுதுங்கள், பாடக் குறிப்புகளை இணைக்கவும் மற்றும் அட்டைப் படங்களைப் பதிவேற்றவும்.'),
    ('b0000000-0000-0000-0000-000000000001', 3, '#tab-scope-platform',
     'Publishing Reach', 'ප්‍රකාශන විෂය පථය', 'வெளியீட்டு எல்லை',
     'Target your assigned classrooms, entire school, or publish nationwide across Growth-tier institutions.',
     'ඔබගේ පන්තියට, සමස්ත පාසලට හෝ දිවයින පුරා ග්‍රෝත් සැලසුම් පාසල් වෙත ලිපි ප්‍රකාශ කරන්න.',
     'உங்கள் வகுப்பறை, முழு பள்ளி அல்லது நாடு முழுவதும் உள்ள வளர்ச்சி நிலை பள்ளிகளுக்கு கட்டுரைகளை வெளியிடுங்கள்.'),

    -- 2. Student Blogs
    ('b0000000-0000-0000-0000-000000000002', 1, NULL,
     'Teacher Articles & Insights', 'ගුරු ලිපි සහ තොරතුරු', 'ஆசிரியர் கட்டுரைகள் & நுண்ணறிவுகள்',
     'Read verified educational blogs, subject breakdowns, and revision summaries written by your teachers.',
     'ඔබගේ ගුරුවරුන් විසින් ලියන ලද නිල අධ්‍යාපනික ලිපි, විෂය කරුණු සහ පුනරීක්ෂණ සටහන් කියවන්න.',
     'உங்கள் ஆசிரியர்கள் எழுதிய சரிபார்க்கப்பட்ட கல்வி கட்டுரைகள், பாட விளக்கங்கள் மற்றும் திருத்தக் குறிப்புகளைப் படியுங்கள்.'),
    ('b0000000-0000-0000-0000-000000000002', 2, '#tab-scope-school',
     'Switch Post Feeds', 'ලිපි ප්‍රවාහ මාරු කරන්න', 'ஊட்டங்களை மாற்றவும்',
     'Browse blogs curated strictly for your school or switch to the nationwide platform knowledge stream.',
     'ඔබගේ පාසලේ ලිපි හෝ දීපව්‍යාප්ත දැනුම් ප්‍රවාහ අතර පහසුවෙන් මාරු වන්න.',
     'உங்கள் பள்ளிக்கான கட்டுரைகள் அல்லது நாடு தழுவிய தள அறிவு ஊட்டங்களுக்கு இடையே மாறுங்கள்.'),

    -- 3. School Admin Blogs Moderation
    ('b0000000-0000-0000-0000-000000000003', 1, NULL,
     'Discourse Supervision', 'අන්තර්ගත අධීක්ෂණය', 'உரையாடல் மேற்பார்வை',
     'Supervise blogs, comments, and discussions published by educators and students in your institution.',
     'ඔබගේ ආයතනයේ ගුරුවරුන් සහ සිසුන් විසින් පළ කරන ලද ලිපි, අදහස් සහ සාකච්ඡා අධීක්ෂණය කරන්න.',
     'உங்கள் நிறுவனத்தில் ஆசிரியர்கள் மற்றும் மாணவர்கள் வெளியிடும் கட்டுரைகள், கருத்துக்கள் மற்றும் விவாதங்களை மேற்பார்வையிடுங்கள்.'),
    ('b0000000-0000-0000-0000-000000000003', 2, '#btn-moderation-reports',
     'Reported Content Queue', 'වාර්තා වූ අන්තර්ගත පෝලිම', 'அறிக்கையிடப்பட்ட உள்ளடக்க வரிசை',
     'Investigate flagged posts and comments to enforce academic standards and community safety.',
     'ශාස්ත්‍රීය ප්‍රමිතීන් සහ ප්‍රජා ආරක්ෂාව තහවුරු කිරීම සඳහා වාර්තා කරන ලද අන්තර්ගත විමර්ශනය කරන්න.',
     'கல்வித் தரங்கள் மற்றும் சமூக பாதுகாப்பை உறுதிப்படுத்த கொடியிடப்பட்ட பதிவுகள் மற்றும் கருத்துகளை ஆராயுங்கள்.'),

    -- 4. Teacher Attendance
    ('b0000000-0000-0000-0000-000000000004', 1, NULL,
     'Digital Attendance Roll Call', 'ඩිජිටල් පැමිණීමේ ලේඛනය', 'டிஜிட்டல் வருகைப்பதிவு',
     'Record daily student attendance by class and period. Works seamlessly online or offline on mobile.',
     'පන්ති සහ කාලච්ඡේද අනුව දෛනික පැමිණීම සටහන් කරන්න. සබැඳිව හෝ නොබැඳිව ක්‍රියා කරයි.',
     'வகுப்பு மற்றும் பாடவேளை வாரியாக தினசரி வருகையை பதிவு செய்யுங்கள். ஆன்லைன் அல்லது ஆஃப்லைனில் தடையின்றி இயங்கும்.'),
    ('b0000000-0000-0000-0000-000000000004', 2, '#attendance-controls',
     'Roster & Date Selection', 'නාමලේඛනය සහ දිනය තෝරාගැනීම', 'பெயர்ப்பட்டியல் மற்றும் தேதி தேர்வு',
     'Select your assigned classroom roster and verify the attendance roll call date.',
     'ඔබගේ පන්තියේ නාමලේඛනය සහ පැමිණීම සටහන් කරන දිනය තෝරන්න.',
     'உங்கள் வகுப்பறை பெயர்ப்பட்டியலைத் தேர்ந்தெடுத்து வருகைப்பதிவு தேதியைச் சரிபார்க்கவும்.'),
    ('b0000000-0000-0000-0000-000000000004', 3, '#attendance-quick-mark-btn',
     'Quick Mark All Present', 'සියලු දෙනා පැමිණි ලෙස සලකුණු කරන්න', 'அனைவரையும் வந்ததாகக் குறிக்கவும்',
     'Quickly mark the entire class present with one click, then adjust absent or late students.',
     'එක් ක්ලික් කිරීමකින් සියලු සිසුන් පැමිණි බව සලකුණු කර, නොපැමිණි සිසුන් පහසුවෙන් වෙනස් කරන්න.',
     'ஒரே கிளிக்கில் முழு வகுப்பையும் வந்ததாகக் குறித்துவிட்டு, வராத மாணவர்களை எளிதாக மாற்றவும்.'),
    ('b0000000-0000-0000-0000-000000000004', 4, '#attendance-save-btn',
     'Save Attendance Roster', 'පැමිණීමේ සටහන සුරකින්න', 'வருகைப்பதிவைச் சேமிக்கவும்',
     'Commit the attendance session securely to the database. Conflicts resolve automatically via LWW rules.',
     'පැමිණීමේ වාර්තාව දත්ත සමුදායට සුරකින්න. ගැටුම් LWW නීති මඟින් ස්වයංක්‍රීයව විසඳේ.',
     'வருகைப் பதிவை தரவுத்தளத்தில் பாதுகாப்பாக சேமிக்கவும். முரண்பாடுகள் தானாகவே தீர்க்கப்படும்.'),

    -- 5. Teacher Homework
    ('b0000000-0000-0000-0000-000000000005', 1, NULL,
     'Homework & Assignment Hub', 'ගෙදර වැඩ සහ පැවරුම් කළමනාකරණය', 'வீட்டுப்பாடம் மற்றும் பணிகள் மையம்',
     'Create curriculum assignments, set deadlines, and review student homework submissions.',
     'විෂයමාලා පැවරුම් සාදන්න, අවසන් දින නියම කරන්න, සහ සිසුන්ගේ ගෙදර වැඩ සමාලෝචනය කරන්න.',
     'பாடத்திட்ட பணிகளை உருவாக்கவும், காலக்கெடுவை நிர்ணயிக்கவும் மற்றும் மாணவர்களின் சமர்ப்பிப்புகளை மதிப்பாய்வு செய்யவும்.'),
    ('b0000000-0000-0000-0000-000000000005', 2, '#create-homework-btn',
     'Create New Assignment', 'නව පැවරුමක් සාදන්න', 'புதிய பணியை உருவாக்குங்கள்',
     'Specify class, subject, submission deadlines, instructions, and maximum possible marks.',
     'පන්තිය, විෂයය, භාරදිය යුතු දිනය, උපදෙස් සහ උපරිම ලකුණු නියම කර නව පැවරුමක් පළ කරන්න.',
     'வகுப்பு, பாடம், சமர்ப்பிப்பு காலக்கெடு, வழிமுறைகள் மற்றும் அதிகபட்ச மதிப்பெண்களைக் குறிப்பிடவும்.'),
    ('b0000000-0000-0000-0000-000000000005', 3, '#homework-tasks-grid',
     'Submission & Grading Review', 'භාරදීම් සහ ලකුණු ලබාදීම', 'சமர்ப்பிப்பு & தரப்படுத்தல் மதிப்பாய்வு',
     'Inspect student attachments, assign marks, and write constructive pedagogical feedback.',
     'සිසුන්ගේ ගොනු පරීක්ෂා කර ලකුණු සහ ප්‍රතිපෝෂණ ලබා දෙන්න.',
     'மாணவர்களின் இணைப்புகளைப் பரிசீலித்து மதிப்பெண்கள் மற்றும் ஆக்கப்பூர்வமான கருத்துக்களை வழங்கவும்.'),

    -- 6. Institution Admin Sync Health
    ('b0000000-0000-0000-0000-000000000006', 1, NULL,
     'Device Synchronization Health', 'උපාංග සමමුහුර්ත සෞඛ්‍යය', 'சாதன ஒத்திசைவு நிலை',
     'Monitor real-time synchronization health across mobile devices used by teachers and students in your school.',
     'ඔබගේ පාසලේ ගුරුවරුන් සහ සිසුන් භාවිතා කරන ජංගම උපාංගවල තත්‍ය කාලීන සමමුහුර්ත තත්ත්වය නිරීක්ෂණය කරන්න.',
     'உங்கள் பள்ளியில் ஆசிரியர்கள் மற்றும் மாணவர்கள் பயன்படுத்தும் மொபைல் சாதனங்களின் ஒத்திசைவு நிலையை கண்காணிக்கவும்.'),
    ('b0000000-0000-0000-0000-000000000006', 2, '#sync-health-devices-card',
     'Active Mobile Fleet', 'සක්‍රිය ජංගම උපාංග සමූහය', 'செயலில் உள்ள சாதனங்கள்',
     'Track active device counts, operating system distributions, and monotonic sequence advancement.',
     'සක්‍රිය උපාංග ගණන, මෙහෙයුම් පද්ධති සහ සමමුහුර්ත අනුක්‍රමයේ ප්‍රගතිය නිරීක්ෂණය කරන්න.',
     'செயலில் உள்ள சாதனங்களின் எண்ணிக்கை, இயக்க முறைமை விநியோகம் மற்றும் வரிசை முன்னேற்றத்தைக் கண்காணிக்கவும்.'),
    ('b0000000-0000-0000-0000-000000000006', 3, '#sync-health-stale-card',
     'Stale Device Safeguards', 'යල් පැන ගිය උපාංග හඳුනාගැනීම', 'காலாவதியான சாதன பாதுகாப்பு',
     'Detect devices that have fallen behind the sync retention window to prevent offline data drift.',
     'නොබැඳි දත්ත පරතරයන් වැළැක්වීම සඳහා සමමුහුර්ත නොකළ යල් පැන ගිය උපාංග හඳුනා ගන්න.',
     'ஆஃப்லைன் தரவு முரண்பாடுகளைத் தடுக்க ஒத்திசைக்கப்படாத காலாவதியான சாதனங்களைக் கண்டறியவும்.')
ON CONFLICT (tutorial_id, step_order) DO NOTHING;

NOTIFY pgrst, 'reload schema';
