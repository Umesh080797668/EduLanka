export type BillingStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE';

export interface VolumeDiscountResult {
    studentCount: number;
    discountPercent: number;
    listedRatePerStudentLkr: number;
    effectiveRatePerStudentLkr: number;
    totalStudentFeeLkr: number;
    isCustomQuote: boolean;
    tierDescription: string;
}

/**
 * Calculates the active student fee with volume discounts according to Blueprint §7b/c:
 * 1 - 250: 0% discount (standard listed rate)
 * 251 - 1,000: 10% discount
 * 1,001 - 3,000: 20% discount
 * 3,000+: Custom quote tier (enterprise negotiation; defaults to baseline 20% or custom negotiated discount)
 * Base Platform Fee is fixed and NEVER discounted.
 */
export function calculateActiveStudentFee(
    studentCount: number,
    pricePerStudentLkr: number,
    customNegotiatedDiscountPercent?: number,
): VolumeDiscountResult {
    let discountPercent = 0;
    let isCustomQuote = false;
    let tierDescription = 'Standard (1-250)';

    if (studentCount > 3000) {
        isCustomQuote = true;
        discountPercent = customNegotiatedDiscountPercent !== undefined ? customNegotiatedDiscountPercent : 20;
        tierDescription = 'Custom Quote (3,000+ Students)';
    } else if (studentCount > 1000) {
        discountPercent = 20;
        tierDescription = 'Volume Tier 2 (1,001-3,000)';
    } else if (studentCount > 250) {
        discountPercent = 10;
        tierDescription = 'Volume Tier 1 (251-1,000)';
    }

    const effectiveRatePerStudentLkr = pricePerStudentLkr * (1 - discountPercent / 100);
    const totalStudentFeeLkr = Math.round(studentCount * effectiveRatePerStudentLkr);

    return {
        studentCount,
        discountPercent,
        listedRatePerStudentLkr: pricePerStudentLkr,
        effectiveRatePerStudentLkr,
        totalStudentFeeLkr,
        isCustomQuote,
        tierDescription,
    };
}

export interface BillingSnapshotRecord {
    id?: string;
    tenantId: string;
    billingMonth: string; // YYYY-MM
    plan: string;
    activeStudentCount: number;
    baseFeeLkr: number;
    perStudentFeeLkr: number;
    smsCount: number;
    smsAllowance: number;
    smsOverageCount: number;
    smsOverageChargeLkr: number;
    totalAmountLkr: number;
    status: BillingStatus;
    updatedAt?: string;
}

export interface UnpaidInvoicePolicyStatus {
    tenantId: string;
    hasOverdueInvoices: boolean;
    inGracePeriod: boolean;
    isAccountLocked: boolean;
    graceDaysRemaining: number;
    overdueAmountLkr: number;
    message: string;
}
