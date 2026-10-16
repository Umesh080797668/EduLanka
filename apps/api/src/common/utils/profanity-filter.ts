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
 * Legitimate names, literary references, and common educational words that might
 * otherwise trigger over-eager prefix or substring matching (the Scunthorpe problem).
 */
const ALLOWED_WORDS = new Set([
    'dickens',
    'fagin',
    'pissarro',
    'scunthorpe',
    'penistone',
    'cockburn',
    'association',
    'assessment',
    'assign',
    'assigned',
    'assignment',
    'assist',
    'assistant',
    'assistance',
    'class',
    'classes',
    'classic',
    'classical',
    'pass',
    'passage',
    'compass',
    'compassion',
]);

const ENGLISH_PROFANITY_ROOTS = new Set([
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
]);

/** Regex pattern for valid grammatical suffixes on English vulgarities */
const ENGLISH_INFLECTIONS = /^(s|es|ed|ing|er|ers|y|ies|head|heads|off)?$/i;

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

            if (ALLOWED_WORDS.has(rawToken) || ALLOWED_WORDS.has(collapsed)) {
                continue;
            }

            for (const root of PROFANITY_ROOTS) {
                // If token exactly matches
                if (rawToken === root || collapsed === root) {
                    return true;
                }

                // If root is English, check bounded inflections rather than arbitrary prefix matching
                if (ENGLISH_PROFANITY_ROOTS.has(root)) {
                    if (rawToken.startsWith(root)) {
                        const remainder = rawToken.slice(root.length);
                        if (ENGLISH_INFLECTIONS.test(remainder)) {
                            return true;
                        }
                    }
                    if (collapsed.startsWith(root)) {
                        const remainder = collapsed.slice(root.length);
                        if (ENGLISH_INFLECTIONS.test(remainder)) {
                            return true;
                        }
                    }
                } else {
                    // Indic / phonetic scripts: prefix match to catch Sinhala/Tamil inflectional morphology
                    if (root.length >= 2) {
                        if (rawToken.startsWith(root) || collapsed.startsWith(root)) {
                            return true;
                        }
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
