-- =============================================================================
-- Migration: 20260820183500_chat_tutorial_seed.sql
-- Description: Seed tutorial config and steps for the new real-time chat interface
-- =============================================================================

INSERT INTO public.tutorials (id, role, screen_id)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', 'GENERAL', 'chat_main')
ON CONFLICT (role, screen_id) DO NOTHING;

INSERT INTO public.tutorial_steps (tutorial_id, step_order, target_element, title_en, title_si, title_ta, content_en, content_si, content_ta)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001', 
        1, 
        NULL, 
        'Welcome to Chat', 
        'චැට් වෙත සාදරයෙන් පිළිගනිමු', 
        'அரட்டைக்கு வரவேற்கிறோம்', 
        'Welcome to your unified messaging platform. You can securely communicate with your classes and peers in real-time.', 
        'ඔබේ ඒකාබද්ධ පණිවිඩකරණ වේදිකාවට සාදරයෙන් පිළිගනිමු. ඔබට තත්‍ය කාලීනව ආරක්ෂිතව පන්ති කණ්ඩායම් සමඟ සන්නිවේදනය කළ හැකිය.', 
        'உங்கள் ஒருங்கிணைந்த செய்தி தளத்திற்கு வரவேற்கிறோம். நீங்கள் நிகழ்நேரத்தில் பாதுகாப்பாக தொடர்பு கொள்ளலாம்.'
    ),
    (
        'c0000000-0000-0000-0000-000000000001', 
        2, 
        'aside', 
        'Conversations List', 
        'සංවාද ලැයිස්තුව', 
        'உரையாடல்களின் பட்டியல்', 
        'Select a class group or direct contact from this sidebar to start a conversation.', 
        'සංවාදයක් ආරම්භ කිරීමට මෙම පැති තීරුවෙන් පන්ති කණ්ඩායමක් තෝරන්න.', 
        'உரையாடலைத் தொடங்க இந்த பக்கப்பட்டியிலிருந்து ஒரு வகுப்பு அல்லது தொடர்பைத் தேர்ந்தெடுக்கவும்.'
    ),
    (
        'c0000000-0000-0000-0000-000000000001', 
        3, 
        'footer', 
        'Send Messages & Read Receipts', 
        'පණිවිඩ යවන්න සහ කියවූ බවට ලකුණු', 
        'செய்திகளை அனுப்பவும்', 
        'Type your messages here. Sent messages will show double checkmarks when read.', 
        'මෙහි පණිවිඩ ටයිප් කරන්න. කියවූ විට යැවූ පණිවිඩ සඳහා ද්විත්ව හරි ලකුණු (✓✓) පෙන්වනු ඇත.', 
        'உங்கள் செய்திகளை இங்கே தட்டச்சு செய்க. படிக்கும்போது, ​​இரட்டை சரிபார்ப்பு மதிப்பெண்கள் காண்பிக்கப்படும்.'
    )
ON CONFLICT DO NOTHING;
