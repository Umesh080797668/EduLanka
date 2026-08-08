// =============================================================================
// EduLanka — Shared Teacher Types
// =============================================================================

/** Sri Lankan curriculum subject areas covering Grades 1–13. */
export enum SubjectArea {
    // Primary & Common Core (Grades 1-9)
    SINHALA = 'SINHALA',
    TAMIL = 'TAMIL',
    ENGLISH = 'ENGLISH',
    MATHEMATICS = 'MATHEMATICS',
    ENVIRONMENT = 'ENVIRONMENT', // ERA
    RELIGION_BUDDHIST = 'RELIGION_BUDDHIST',
    RELIGION_CHRISTIAN = 'RELIGION_CHRISTIAN',
    RELIGION_CATHOLIC = 'RELIGION_CATHOLIC',
    RELIGION_ISLAM = 'RELIGION_ISLAM',
    RELIGION_HINDU = 'RELIGION_HINDU',
    SCIENCE = 'SCIENCE',
    HISTORY = 'HISTORY',
    GEOGRAPHY = 'GEOGRAPHY',
    CIVICS = 'CIVICS',
    HEALTH_PE = 'HEALTH_PE',
    PTS = 'PTS', // Practical and Technical Skills

    // O/L & A/L Common Elective Subjects (Languages & Aesthetics)
    PALI = 'PALI',
    SANSKRIT = 'SANSKRIT',
    FRENCH = 'FRENCH',
    JAPANESE = 'JAPANESE',
    GERMAN = 'GERMAN',
    CHINESE = 'CHINESE',
    KOREAN = 'KOREAN',
    RUSSIAN = 'RUSSIAN',
    HINDI = 'HINDI',
    ARABIC = 'ARABIC',
    MALAY = 'MALAY', // A/L

    ART = 'ART',
    ORIENTAL_MUSIC = 'ORIENTAL_MUSIC', // Eastern
    WESTERN_MUSIC = 'WESTERN_MUSIC',
    CARNATIC_MUSIC = 'CARNATIC_MUSIC',
    ORIENTAL_DANCING = 'ORIENTAL_DANCING', // Sinhala
    BHARATHA_DANCING = 'BHARATHA_DANCING',

    // Specific O/L Subjects
    BUSINESS_ACCOUNTING = 'BUSINESS_ACCOUNTING',
    ENTREPRENEURSHIP = 'ENTREPRENEURSHIP',
    SECOND_LANGUAGE_SINHALA = 'SECOND_LANGUAGE_SINHALA',
    SECOND_LANGUAGE_TAMIL = 'SECOND_LANGUAGE_TAMIL',
    DRAMA_SINHALA = 'DRAMA_SINHALA',
    DRAMA_TAMIL = 'DRAMA_TAMIL',
    DRAMA_ENGLISH = 'DRAMA_ENGLISH',
    LITERATURE_SINHALA = 'LITERATURE_SINHALA',
    LITERATURE_TAMIL = 'LITERATURE_TAMIL',
    LITERATURE_ENGLISH = 'LITERATURE_ENGLISH',
    LITERATURE_ARABIC = 'LITERATURE_ARABIC',
    ICT = 'ICT',
    AGRICULTURE = 'AGRICULTURE',
    MECH_TECH = 'MECH_TECH', // Design and Mechanical Tech
    CIVIL_TECH = 'CIVIL_TECH', // Design and Construction
    ELEC_TECH = 'ELEC_TECH', // Design and Electrical
    HOME_ECONOMICS = 'HOME_ECONOMICS',
    MEDIA_STUDIES = 'MEDIA_STUDIES',
    ART_CRAFT = 'ART_CRAFT',
    AQUATIC_TECH = 'AQUATIC_TECH',

    // Specific A/L Subjects
    GENERAL_ENGLISH = 'GENERAL_ENGLISH',
    CGT = 'CGT', // Common General Test
    GIT = 'GIT', // General Information Technology
    COMBINED_MATHS = 'COMBINED_MATHS',
    PHYSICS = 'PHYSICS',
    CHEMISTRY = 'CHEMISTRY',
    HIGHER_MATHS = 'HIGHER_MATHS',
    BIOLOGY = 'BIOLOGY',
    AGRI_SCIENCE = 'AGRI_SCIENCE',
    ACCOUNTING = 'ACCOUNTING',
    BUSINESS_STUDIES = 'BUSINESS_STUDIES',
    ECONOMICS = 'ECONOMICS',
    BUSINESS_STATISTICS = 'BUSINESS_STATISTICS',
    SCIENCE_FOR_TECH = 'SCIENCE_FOR_TECH',
    ENGINEERING_TECH = 'ENGINEERING_TECH',
    BIOSYSTEMS_TECH = 'BIOSYSTEMS_TECH',
    POLITICAL_SCIENCE = 'POLITICAL_SCIENCE',
    LOGIC = 'LOGIC', // Logic and Scientific Method
    HISTORY_SRI_LANKAN = 'HISTORY_SRI_LANKAN',
    HISTORY_INDIAN = 'HISTORY_INDIAN',
    HISTORY_MODERN_WORLD = 'HISTORY_MODERN_WORLD',
    BUDDHIST_CIV = 'BUDDHIST_CIV',
    HINDU_CIV = 'HINDU_CIV',
    ISLAMIC_CIV = 'ISLAMIC_CIV',
    GREEK_ROMAN_CIV = 'GREEK_ROMAN_CIV',

    // Other
    PHYSICAL_EDUCATION = 'PHYSICAL_EDUCATION',
    OTHER = 'OTHER',
}

export interface TeacherProfile {
    id: string;
    user_id: string;
    employee_no: string;
    subject_areas: SubjectArea[];
    hire_date?: string | null; // ISO-8601 date
    created_at: string;

    users?: {
        full_name: string;
        email: string;
        phone_number: string | null;
        avatar_url: string | null;
        is_active?: boolean;
    };
}

export interface ClassTeacherAssignment {
    id: string;
    class_id: string;
    teacher_id: string;
    is_homeroom: boolean;
    subject?: SubjectArea | null;

    // NestJS joins
    teachers?: TeacherProfile;
    teacher?: any; // For nested cases
}
