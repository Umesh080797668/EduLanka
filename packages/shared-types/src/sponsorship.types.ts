// =============================================================================
// EduLanka — Shared Sponsorship & Sponsored Growth Types
// =============================================================================

export enum BeneficiaryType {
    SCHOOL = 'SCHOOL',
    INDEPENDENT_LEARNER = 'INDEPENDENT_LEARNER',
}

export enum GrantEventType {
    GRANTED = 'GRANTED',
    EXPIRY_WARNING = 'EXPIRY_WARNING',
    EXPIRED = 'EXPIRED',
    MANUAL_REVOKED = 'MANUAL_REVOKED',
}

export interface SponsorshipPool {
    id: string;
    periodMonth: string; // YYYY-MM-DD
    netProfitLkr: number;
    poolFraction: number; // e.g. 0.10
    poolAmountLkr: number;
    remainingLkr: number;
    createdAt: string;
}

export interface SponsoredGrant {
    id: string;
    poolId?: string;
    beneficiaryType: BeneficiaryType;
    beneficiaryId: string;
    fromPlan: string;
    toPlan: string;
    grantedAt: string;
    expiresAt: string;
    grantedBy?: string;
    estimatedCostLkr: number;
    isActive: boolean;
    notes?: string;
}

export interface SponsoredGrantEvent {
    id: string;
    grantId: string;
    eventType: GrantEventType;
    actorId?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}
