-- =============================================================================
-- Migration: 20260821000003_notice_tutorials.sql
-- Description: Seed Notice composer tutorials
-- =============================================================================

INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('b9999999-9999-9999-9999-999999999999', 'SCHOOL_ADMIN', 'notices')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES
    (
        'b9999999-9999-9999-9999-999999999999', 
        1, 
        NULL, 
        'Notice Composer', 
        'දැනුම්දීම් නිර්මාපකය', 
        'அறிவிப்பு உருவாக்குபவர்', 
        'Welcome to the Notice system. Here you can write critical updates and broadcast them directly to specific target audiences reliably.', 
        'දැනුම්දීම් පද්ධතියට සාදරයෙන් පිළිගනිමු. මෙහිදී ඔබට වැදගත් යාවත්කාලීනයන් ලිවීමට සහ ඒවා නිශ්චිත ඉලක්කගත ප්‍රේක්ෂකයින් වෙත සෘජුවම විකාශනය කිරීමට හැකිය.', 
        'அறிவிப்பு அமைப்புக்கு வரவேற்கிறோம். இங்கே நீங்கள் முக்கியமான புதுப்பிப்புகளை எழுதலாம் மற்றும் குறிப்பிட்ட பார்வையாளர்களுக்கு நேரடியாக ஒளிபரப்பலாம்.'
    ),
    (
        'b9999999-9999-9999-9999-999999999999', 
        2, 
        'form select:first-of-type',
        'Audience Scoping',
        'ප්‍රේක්ෂක ඉලක්ක කිරීම',
        'பார்வையாளர்களை இலக்காக்குதல்',
        'Select the scoping level of your notice. Note: Free tier schools are strictly limited to School-Wide scopes. Upgrading unlocks specific grading and classroom level scopes.',
        'ඔබේ නිවේදනයේ ඉලක්ක මට්ටම තෝරන්න. සටහන: නොමිලේ සැලසුම් ඇති පාසල් සඳහා පාසල පුරා විෂයසීමාවන්ට පමණක් සීමා වේ.',
        'உங்கள் அறிவிப்பின் நோக்கை தேர்ந்தெடுக்கவும். குறிப்பு: இலவச திட்டங்களில் பள்ளிகள் முழு பள்ளி நோக்கங்களுக்கு மட்டுமே வரையறுக்கப்பட்டுள்ளன.'
    )
ON CONFLICT DO NOTHING;
