// =============================================================================
// EduLanka — Shared Parent Types
// =============================================================================

import type { TenantRef } from './tenant.types.js';

export enum ParentRelationship {
    FATHER = 'FATHER',
    MOTHER = 'MOTHER',
    GUARDIAN = 'GUARDIAN',
    SIBLING = 'SIBLING',
    OTHER = 'OTHER',
}

export interface ParentProfile {
    id: string;
    userId: string;
    tenant: TenantRef;
    fullName: string;
    email: string;
    phoneNumber?: string;
    isActive: boolean;
    /** IDs of linked students (one parent → many children). */
    childIds: string[];
    createdAt: string;
    updatedAt: string;
}

export interface ParentChildLink {
    id: string;
    parentUserId: string;
    studentId: string;
    relationship: ParentRelationship;
    createdAt: string;
}
