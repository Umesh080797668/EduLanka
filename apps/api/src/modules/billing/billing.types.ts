export type BillingStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE';

export interface VolumeDiscountResult {
    studentCount: number;
    discountPercent: number;
    listedRatePerStudentLkr: number;
    effectiveRatePerStudentLkr: number;
    totalStudentFeeLkr: number;
}

/**
 * Calculates the active student fee with volume discounts according to Blueprint §7b:
 * 1 - 250: 0% discount (listed rate)
 * 251 - 1,000: 10% discount
 * 1,001 - 3,000: 20% discount
 * 3,000+: 20% discount
 * Base Platform Fee is fixed and NEVER discounted.
 */
export function calculateActiveStudentFee(
    studentCount: number,
    pricePerStudentLkr: number,
): VolumeDiscountResult {
    let discountPercent = 0;
    if (studentCount > 1000) {
        discountPercent = 20;
    } else if (studentCount > 250) {
        discountPercent = 10;
    }

    const effectiveRatePerStudentLkr = pricePerStudentLkr * (1 - discountPercent / 100);
    const totalStudentFeeLkr = Math.round(studentCount * effectiveRatePerStudentLkr);

    return {
        studentCount,
        discountPercent,
        listedRatePerStudentLkr: pricePerStudentLkr,
        effectiveRatePerStudentLkr,
        totalStudentFeeLkr,
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
