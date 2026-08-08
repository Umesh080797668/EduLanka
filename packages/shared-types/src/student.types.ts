// =============================================================================
// EduLanka — Shared Student Types
// =============================================================================

export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER',
}

export enum InstructionMedium {
    ENGLISH = 'ENGLISH',
    SINHALA = 'SINHALA',
    TAMIL = 'TAMIL',
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
    user_id: string; // The joined user_id
    class_id?: string | null;
    admission_no: string;
    medium?: InstructionMedium | null;
    date_of_birth?: string | null; // ISO-8601 date
    gender?: Gender | null;
    al_stream?: ALStream | null;
    created_at: string;

    // NestJS mapped versions (using snake_case since Supabase returns it like this directly without transformation)
    users?: {
        full_name: string;
        email: string;
        phone_number: string | null;
        avatar_url: string | null;
        role?: string;
        is_active?: boolean;
    };

    classes?: {
        grade: number;
        section: string;
        year: number;
    } | null;

    parent_children?: Array<{
        parent_user_id: string;
        relationship: string;
        users: {
            full_name: string;
            email: string;
        }
    }>;
}
