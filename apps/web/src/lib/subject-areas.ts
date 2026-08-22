/**
 * Presentation helpers for the `SubjectArea` enum.
 *
 * The enum carries 80 Sri Lankan curriculum subjects spanning Grades 1–13, so
 * anything that shows them needs a readable label and — for the picker — some
 * grouping. Both live here so the directory, the profile page and the editor
 * cannot drift apart.
 */

import { SubjectArea } from '@edu-lanka/shared-types';

/**
 * Names that title-casing the enum member gets wrong: initialisms that must
 * stay upper case, and abbreviations only the curriculum knows.
 */
const LABEL_OVERRIDES: Partial<Record<SubjectArea, string>> = {
    [SubjectArea.ENVIRONMENT]: 'Environment (ERA)',
    [SubjectArea.HEALTH_PE]: 'Health & Physical Education',
    [SubjectArea.PTS]: 'Practical & Technical Skills',
    [SubjectArea.ICT]: 'ICT',
    [SubjectArea.CGT]: 'Common General Test',
    [SubjectArea.GIT]: 'General Information Technology',
    [SubjectArea.MECH_TECH]: 'Design & Mechanical Technology',
    [SubjectArea.CIVIL_TECH]: 'Design & Construction Technology',
    [SubjectArea.ELEC_TECH]: 'Design & Electrical Technology',
    [SubjectArea.AQUATIC_TECH]: 'Aquatic Bioresources Technology',
    [SubjectArea.LOGIC]: 'Logic & Scientific Method',
    [SubjectArea.BUDDHIST_CIV]: 'Buddhist Civilisation',
    [SubjectArea.HINDU_CIV]: 'Hindu Civilisation',
    [SubjectArea.ISLAMIC_CIV]: 'Islamic Civilisation',
    [SubjectArea.GREEK_ROMAN_CIV]: 'Greek & Roman Civilisation',
    [SubjectArea.SECOND_LANGUAGE_SINHALA]: 'Sinhala (Second Language)',
    [SubjectArea.SECOND_LANGUAGE_TAMIL]: 'Tamil (Second Language)',
    [SubjectArea.ORIENTAL_MUSIC]: 'Oriental Music (Eastern)',
    [SubjectArea.ORIENTAL_DANCING]: 'Oriental Dancing (Sinhala)',
    [SubjectArea.AGRI_SCIENCE]: 'Agricultural Science',
    [SubjectArea.SCIENCE_FOR_TECH]: 'Science for Technology',
    [SubjectArea.ENGINEERING_TECH]: 'Engineering Technology',
    [SubjectArea.BIOSYSTEMS_TECH]: 'Biosystems Technology',
    [SubjectArea.COMBINED_MATHS]: 'Combined Mathematics',
    [SubjectArea.HIGHER_MATHS]: 'Higher Mathematics',
    [SubjectArea.MATHEMATICS]: 'Mathematics',
};

/** Enum members are SCREAMING_SNAKE; render them as readable title case. */
export function subjectLabel(value: string): string {
    const override = LABEL_OVERRIDES[value as SubjectArea];
    if (override) return override;

    return value
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Group keys double as i18n message keys (`subjectGroup_<key>` in the
 * `InstitutionAdminTeachers` namespace).
 */
export interface SubjectGroup {
    key: string;
    subjects: SubjectArea[];
}

/**
 * Curriculum bands, ordered the way a Sri Lankan timetable reads: the common
 * core first, then the electives that branch at O/L/A/L.
 */
export const SUBJECT_GROUPS: SubjectGroup[] = [
    {
        key: 'core',
        subjects: [
            SubjectArea.SINHALA,
            SubjectArea.TAMIL,
            SubjectArea.ENGLISH,
            SubjectArea.MATHEMATICS,
            SubjectArea.SCIENCE,
            SubjectArea.ENVIRONMENT,
            SubjectArea.HISTORY,
            SubjectArea.GEOGRAPHY,
            SubjectArea.CIVICS,
            SubjectArea.HEALTH_PE,
            SubjectArea.PTS,
        ],
    },
    {
        key: 'religion',
        subjects: [
            SubjectArea.RELIGION_BUDDHIST,
            SubjectArea.RELIGION_CHRISTIAN,
            SubjectArea.RELIGION_CATHOLIC,
            SubjectArea.RELIGION_ISLAM,
            SubjectArea.RELIGION_HINDU,
            SubjectArea.BUDDHIST_CIV,
            SubjectArea.HINDU_CIV,
            SubjectArea.ISLAMIC_CIV,
            SubjectArea.GREEK_ROMAN_CIV,
        ],
    },
    {
        key: 'languages',
        subjects: [
            SubjectArea.SECOND_LANGUAGE_SINHALA,
            SubjectArea.SECOND_LANGUAGE_TAMIL,
            SubjectArea.GENERAL_ENGLISH,
            SubjectArea.PALI,
            SubjectArea.SANSKRIT,
            SubjectArea.ARABIC,
            SubjectArea.HINDI,
            SubjectArea.MALAY,
            SubjectArea.FRENCH,
            SubjectArea.GERMAN,
            SubjectArea.RUSSIAN,
            SubjectArea.CHINESE,
            SubjectArea.JAPANESE,
            SubjectArea.KOREAN,
        ],
    },
    {
        key: 'literature',
        subjects: [
            SubjectArea.LITERATURE_SINHALA,
            SubjectArea.LITERATURE_TAMIL,
            SubjectArea.LITERATURE_ENGLISH,
            SubjectArea.LITERATURE_ARABIC,
            SubjectArea.DRAMA_SINHALA,
            SubjectArea.DRAMA_TAMIL,
            SubjectArea.DRAMA_ENGLISH,
        ],
    },
    {
        key: 'aesthetics',
        subjects: [
            SubjectArea.ART,
            SubjectArea.ART_CRAFT,
            SubjectArea.ORIENTAL_MUSIC,
            SubjectArea.WESTERN_MUSIC,
            SubjectArea.CARNATIC_MUSIC,
            SubjectArea.ORIENTAL_DANCING,
            SubjectArea.BHARATHA_DANCING,
            SubjectArea.MEDIA_STUDIES,
        ],
    },
    {
        key: 'commerce',
        subjects: [
            SubjectArea.BUSINESS_ACCOUNTING,
            SubjectArea.ENTREPRENEURSHIP,
            SubjectArea.ACCOUNTING,
            SubjectArea.BUSINESS_STUDIES,
            SubjectArea.ECONOMICS,
            SubjectArea.BUSINESS_STATISTICS,
        ],
    },
    {
        key: 'sciences',
        subjects: [
            SubjectArea.COMBINED_MATHS,
            SubjectArea.HIGHER_MATHS,
            SubjectArea.PHYSICS,
            SubjectArea.CHEMISTRY,
            SubjectArea.BIOLOGY,
            SubjectArea.AGRI_SCIENCE,
            SubjectArea.SCIENCE_FOR_TECH,
        ],
    },
    {
        key: 'technology',
        subjects: [
            SubjectArea.ICT,
            SubjectArea.GIT,
            SubjectArea.ENGINEERING_TECH,
            SubjectArea.BIOSYSTEMS_TECH,
            SubjectArea.MECH_TECH,
            SubjectArea.CIVIL_TECH,
            SubjectArea.ELEC_TECH,
            SubjectArea.AQUATIC_TECH,
            SubjectArea.AGRICULTURE,
            SubjectArea.HOME_ECONOMICS,
        ],
    },
    {
        key: 'social',
        subjects: [
            SubjectArea.POLITICAL_SCIENCE,
            SubjectArea.LOGIC,
            SubjectArea.HISTORY_SRI_LANKAN,
            SubjectArea.HISTORY_INDIAN,
            SubjectArea.HISTORY_MODERN_WORLD,
        ],
    },
    {
        key: 'other',
        subjects: [SubjectArea.CGT, SubjectArea.PHYSICAL_EDUCATION, SubjectArea.OTHER],
    },
];

/**
 * Anything added to the enum later still has to be selectable, so sweep the
 * leftovers into the trailing group rather than silently hiding them.
 */
const grouped = new Set(SUBJECT_GROUPS.flatMap((group) => group.subjects));
const ungrouped = (Object.values(SubjectArea) as SubjectArea[]).filter(
    (subject) => !grouped.has(subject),
);
if (ungrouped.length > 0) {
    SUBJECT_GROUPS[SUBJECT_GROUPS.length - 1]!.subjects.push(...ungrouped);
}
