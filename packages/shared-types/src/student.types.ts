// =============================================================================
// EduLanka — Shared Student Types
// =============================================================================

import type { TenantRef } from './tenant.types.js';

export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER',
}

export enum Grade {
    GRADE_1 = 'GRADE_1',
    GRADE_2 = 'GRADE_2',
    GRADE_3 = 'GRADE_3',
    GRADE_4 = 'GRADE_4',
    GRADE_5 = 'GRADE_5',
    GRADE_6 = 'GRADE_6',
    GRADE_7 = 'GRADE_7',
    GRADE_8 = 'GRADE_8',
    GRADE_9 = 'GRADE_9',
    GRADE_10 = 'GRADE_10',
    GRADE_11 = 'GRADE_11',
    GRADE_12 = 'GRADE_12',
    GRADE_13 = 'GRADE_13',
}

/** Sri Lankan A/L stream classification. */
export enum ALStream {
    SCIENCE = 'SCIENCE',
    MATHS = 'MATHS',
    COMMERCE = 'COMMERCE',
    ARTS = 'ARTS',
    TECHNOLOGY = 'TECHNOLOGY',
    BIO_SCIENCE = 'BIO_SCIENCE',
    COMMON = 'COMMON',
}

export interface StudentProfile {
    id: string;
    userId: string;
    tenant: TenantRef;
    admissionNumber: string;
    fullName: string;
    preferredName?: string;
    dateOfBirth: string; // ISO-8601 date
    gender: Gender;
    grade: Grade;
    classSection: string; // e.g. "9-A", "11-B"
    alStream?: ALStream;
    parentIds: string[];
    isActive: boolean;
    enrolledAt: string;
    createdAt: string;
    updatedAt: string;
}
