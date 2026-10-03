/**
 * SMS Segment and Encoding Calculator for GSM-7 and UCS-2 (Sinhala/Tamil).
 *
 * GSM-7:
 *   - Single message: up to 160 characters
 *   - Concatenated: 153 characters per segment (7 bytes reserved for UDH header)
 *
 * UCS-2 (Unicode - Sinhala, Tamil, Diacritics, Emojis):
 *   - Single message: up to 70 characters
 *   - Concatenated: 67 characters per segment (6 bytes reserved for UDH header)
 */
export function calculateSmsSegments(text: string): {
    encoding: 'GSM-7' | 'UCS-2';
    charCount: number;
    segmentCount: number;
} {
    if (!text || text.length === 0) {
        return { encoding: 'GSM-7', charCount: 0, segmentCount: 0 };
    }

    // Standard GSM 03.38 basic character set + extension characters
    const isGsm7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1B\x0c^{}\[~\]\\|\u20ACÆæßÉ !"#%&'()*+,\-.\/0-9:;<=>?A-ZÄÖÑÜ§¿a-zäöñüà]*$/.test(text);
    const charCount = Array.from(text).length;

    if (isGsm7) {
        const segmentCount = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
        return { encoding: 'GSM-7', charCount, segmentCount };
    } else {
        const segmentCount = charCount <= 70 ? 1 : Math.ceil(charCount / 67);
        return { encoding: 'UCS-2', charCount, segmentCount };
    }
}
