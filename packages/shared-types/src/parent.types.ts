// =============================================================================
// EduLanka — Shared Parent Types
// =============================================================================

// Removed unused TenantRef import

export enum ParentRelationship {
    FATHER = 'FATHER',
    MOTHER = 'MOTHER',
    GUARDIAN = 'GUARDIAN',
    SIBLING = 'SIBLING',
    OTHER = 'OTHER',
}

export interface ParentProfile {
    id: string; // user.id
    email: string;
    full_name: string;
    phone_number?: string;
    role: string;
    is_active: boolean;
    parent_children?: any[]; // nested mappings
    created_at: string;
    updated_at: string;
}

export interface ParentChildLink {
    id: string;
    parentUserId: string;
    studentId: string;
    relationship: ParentRelationship;
    createdAt: string;
}
