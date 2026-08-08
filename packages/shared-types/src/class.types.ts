// =============================================================================
// EduLanka — Shared Class Types
// =============================================================================

import type { ClassTeacherAssignment } from './teacher.types.js';
import type { InstructionMedium } from './student.types.js';

export interface ClassProfile {
    id: string;
    grade: number; // 1-13
    section: string; // 'A', 'B', 'Science', etc.
    medium?: InstructionMedium;
    year: number; // e.g. 2026
    studentCount?: number;
    class_teachers?: ClassTeacherAssignment[];
    created_at: string;
}

/** Lightweight reference used in nested objects. */
export interface ClassRef {
    id: string;
    grade: number;
    section: string;
    year: number;
}
