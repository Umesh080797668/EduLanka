import { BadRequestException } from '@nestjs/common';

/**
 * Multilingual profanity and slur word list for Sri Lankan educational context.
 * Covers English, Sinhala (script and romanized/Singlish), and Tamil (script and romanized/Tanglish).
 */
const PROFANITY_ROOTS = [
    // English vulgarities / slurs
    'asshole',
    'bastard',
    'bitch',
    'bullshit',
    'cunt',
    'dick',
    'douche',
    'fag',
    'faggot',
    'fuck',
    'motherfuck',
    'nigger',
    'nigga',
    'piss',
    'pussy',
    'shit',
    'slut',
    'twat',
    'whore',

    // Sinhala script profanities / vulgarities (roots & inflections)
    'හුත්ත',
    'හුක',
    'හුකන',
    'පක',
    'පයිය',
    'කැරි',
    'වේසි',
    'වේසා',
    'පොන්න',

    // Sinhala romanized / Singlish
    'huthth',
    'hukan',
    'pakay',
    'pakaya',
    'paka',
    'payiy',
    'kariy',
    'kaeri',
    'wesi',
    'wesig',
    'ponnay',

    // Tamil script profanities / vulgarities
    'தேவிடியா',
    'ஓத்தா',
    'புண்டை',
    'சுன்னி',
    'நாயே',
    'பொட்ட',

    // Tamil romanized / Tanglish
    'thevidiya',
    'oththa',
    'pundai',
    'sunni',
    'naye',
    'potta',
];

/**
 * Normalizes text to detect obfuscated profanity:
 * - Replaces common leet/symbol substitutions
 * - Collapses consecutive identical characters (e.g., fuuuuck -> fuck)
 */
function normalizeVariants(text: string): string[] {
    if (!text) return [];
    const base = text.toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Variant 1: raw letters/unicode tokens
    const variants: string[] = [base];

    // Variant 2: symbol mapped (e.g. @ -> a, $ -> s, 0 -> o, ! / 1 / * -> u / i)
    const leet1 = base
        .replace(/@/g, 'a')
        .replace(/4/g, 'a')
        .replace(/\$/g, 's')
        .replace(/5/g, 's')
        .replace(/0/g, 'o')
        .replace(/[!1*]/g, 'u')
        .replace(/3/g, 'e');
    variants.push(leet1);

    const leet2 = base
        .replace(/@/g, 'a')
        .replace(/4/g, 'a')
        .replace(/\$/g, 's')
        .replace(/5/g, 's')
        .replace(/0/g, 'o')
        .replace(/[!1*]/g, 'i')
        .replace(/3/g, 'e');
    variants.push(leet2);

    return variants;
}

/**
 * Checks whether the given text contains any prohibited profanity or offensive terms.
 */
export function containsProfanity(text?: string | null): boolean {
    if (!text || typeof text !== 'string') return false;

    const variants = normalizeVariants(text);

    for (const variant of variants) {
        // Extract words/tokens including letters, marks (for Indic scripts), and numbers
        const tokens = variant.match(/[\p{L}\p{M}\p{N}]+/gu) || [];

        for (const rawToken of tokens) {
            // Check collapsed version: e.g. "fuuuuck" -> "fuck"
            const collapsed = rawToken.replace(/(.)\1{2,}/g, '$1');

            for (const root of PROFANITY_ROOTS) {
                // If token exactly matches or begins with root (to catch inflections like හුත්තක්, bitchy, asshole)
                if (rawToken === root || collapsed === root) {
                    return true;
                }

                // Prefix match for Sinhala/Tamil and English stems
                if (root.length >= 2) {
                    if (rawToken.startsWith(root) || collapsed.startsWith(root)) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Asserts that content does not contain prohibited profanities.
 * Throws BadRequestException if any profanity is detected.
 */
export function assertCleanContent(text?: string | null, fieldName = 'Content'): void {
    if (containsProfanity(text)) {
        throw new BadRequestException(
            `${fieldName} contains inappropriate or offensive language. Please adhere to the school code of conduct.`,
        );
    }
}
