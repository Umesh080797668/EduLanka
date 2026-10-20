// =============================================================================
// EduLanka — Shared Independent Learner Types
// =============================================================================

export enum LearnerType {
    OUT_OF_SCHOOL = 'OUT_OF_SCHOOL',
    PRIVATE_CANDIDATE = 'PRIVATE_CANDIDATE',
    GENERAL = 'GENERAL',
}

export enum CandidateLevel {
    OL = 'OL',
    AL = 'AL',
    OTHER = 'OTHER',
}

export enum IndividualPlan {
    FREE_INDIVIDUAL = 'FREE_INDIVIDUAL',
    INDIVIDUAL_PRO = 'INDIVIDUAL_PRO',
    INDIVIDUAL_PREMIUM = 'INDIVIDUAL_PREMIUM',
}

export interface IndependentLearner {
    id: string;
    userId: string;
    learnerType: LearnerType;
    candidateLevel?: CandidateLevel;
    examYear?: number;
    examIndexNumber?: string;
    stream?: string;
    plan: IndividualPlan;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
