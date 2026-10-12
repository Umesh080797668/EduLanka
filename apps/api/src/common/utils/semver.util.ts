/**
 * Robust, lightweight Semantic Versioning (SemVer) parser and comparator.
 */
export function parseSemver(v: string): [number, number, number] | null {
    if (!v || typeof v !== 'string') return null;
    const match = v.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Returns:
 * -1 if v1 < v2
 *  0 if v1 === v2
 *  1 if v1 > v2
 */
export function compareSemver(v1: string, v2: string): number {
    const p1 = parseSemver(v1);
    const p2 = parseSemver(v2);
    if (!p1 || !p2) {
        throw new Error(`Invalid semver comparison between "${v1}" and "${v2}"`);
    }
    for (let i = 0; i < 3; i++) {
        if (p1[i] < p2[i]) return -1;
        if (p1[i] > p2[i]) return 1;
    }
    return 0;
}
