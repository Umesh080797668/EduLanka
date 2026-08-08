// =============================================================================
// EduLanka — Shared Class Types
// =============================================================================

import type { ClassTeacherAssignment } from './teacher.types.js';
import type { InstructionMedium } from './student.types.js';

export interface GradeProfile {
    id: string;
    level: number;
    name: string;
    curriculum_type: string;
    is_active: boolean;
}

export interface ClassProfile {
    id: string;
    grade_id: string; // Foreign key to grades
    grade?: GradeProfile; // Expanded relation
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
    grade_id: string;
    section: string;
    year: number;
}
