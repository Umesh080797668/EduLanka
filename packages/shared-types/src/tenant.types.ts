// =============================================================================
// EduLanka — Shared Tenant Types
// =============================================================================

/** Subscription tier — maps to the Free / Pro pricing model. */
export enum TenantPlan {
    FREE = 'FREE',
    PRO = 'PRO',
}

/** Lifecycle status of a tenant (school). */
export enum TenantStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    PROVISIONING = 'PROVISIONING',
    DEPROVISIONED = 'DEPROVISIONED',
}

/** Sri Lankan school classification per MoE taxonomy. */
export enum SchoolType {
    TYPE_1AB = 'TYPE_1AB', // National schools — A/L streams
    TYPE_1C = 'TYPE_1C',   // Provincial — A/L (some streams)
    TYPE_2 = 'TYPE_2',     // Up to O/L (Grade 11)
    TYPE_3 = 'TYPE_3',     // Primary up to Grade 8
    PRIVATE = 'PRIVATE',   // Approved private / semi-gov
}

export interface Tenant {
    id: string;
    name: string;
    slug: string; // unique identifier for schema routing, e.g. "richmond-college"
    plan: TenantPlan;
    status: TenantStatus;
    schoolType: SchoolType;
    logoUrl?: string;
    contactEmail: string;
    phoneNumber?: string;
    smsApproved?: boolean; // System Admin controlled — whether SMS features are enabled for this tenant
    address?: TenantAddress;
    createdAt: string; // ISO-8601
    updatedAt: string;
}

export interface TenantAddress {
    street?: string;
    city: string;
    district: string;
    province: string;
    postalCode?: string;
}

/** Lightweight ref used in nested objects. */
export interface TenantRef {
    id: string;
    name: string;
    slug: string;
    plan: TenantPlan;
}
