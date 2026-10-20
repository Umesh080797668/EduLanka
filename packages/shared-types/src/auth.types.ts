// =============================================================================
// EduLanka — Shared Auth Types
// =============================================================================

/** Roles defined at the platform level. */
export enum UserRole {
    STUDENT = 'STUDENT',
    PARENT = 'PARENT',
    TEACHER = 'TEACHER',
    SCHOOL_ADMIN = 'SCHOOL_ADMIN',
    ZONAL_OFFICER = 'ZONAL_OFFICER',
    MOE_OFFICER = 'MOE_OFFICER',
    SUPER_ADMIN = 'SUPER_ADMIN',
    INDEPENDENT_LEARNER = 'INDEPENDENT_LEARNER',
}

/** JWT payload shape embedded in every access token. */
export interface JwtPayload {
    sub: string; // user UUID
    tenantId: string; // school tenant UUID (empty string or platform ID for independent learners)
    tenantSlug?: string;
    tenantPlan?: 'COMMUNITY' | 'STARTER' | 'GROWTH' | 'INSTITUTIONAL' | 'FREE_INDIVIDUAL' | 'INDIVIDUAL_PRO' | 'INDIVIDUAL_PREMIUM'; // Tier-gated feature claims per P3-S1
    role: UserRole;
    email: string;
    type?: 'access' | 'refresh'; // token category
    jti?: string; // JWT ID — used for refresh-token denylist lookups
    iat?: number;
    exp?: number;
}

/** Standard API response envelope. */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: PaginationMeta;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

export interface PaginationMeta {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface PaginationQuery {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
