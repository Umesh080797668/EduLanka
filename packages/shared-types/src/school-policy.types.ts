// =============================================================================
// EduLanka — Shared School Policy Types
// =============================================================================

import type { InstructionMedium } from './student.types.js';

export interface SchoolPolicy {
    id: string;
    academic_year: number; // e.g. 2026
    max_students_per_class: number; // default 40
    allow_self_enrollment: boolean;
    sms_enabled: boolean;
    default_language: 'en' | 'si' | 'ta'; // English / Sinhala / Tamil
    supported_mediums?: InstructionMedium[];
    timezone: string; // default 'Asia/Colombo'
    school_hours_start: string; // 'HH:MM:SS'
    school_hours_end: string;
}

export type UpdateSchoolPolicyInput = Partial<Omit<SchoolPolicy, 'id'>>;
