import type { BadgeTone } from '@/components/ui/Badge';

/**
 * Sri Lankan school grading bands, best → worst. `key` is a `StudentGrades`/
 * `ParentGrades` message key so callers stay localized.
 */
export function gradeFor(marks: number): { key: string; tone: BadgeTone } {
    if (marks >= 75) return { key: 'gradeA', tone: 'success' };
    if (marks >= 65) return { key: 'gradeB', tone: 'info' };
    if (marks >= 50) return { key: 'gradeC', tone: 'primary' };
    if (marks >= 35) return { key: 'gradeS', tone: 'warning' };
    return { key: 'gradeW', tone: 'danger' };
}
