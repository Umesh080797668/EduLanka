// =============================================================================
// EduLanka — k6 Load Test Config
// Override any value with -e KEY=value, e.g.:
//   k6 run -e BASE_URL=https://api.edulanka.lk/api/v1 -e TENANT_ID=... full-system.js
// =============================================================================

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8081/api/v1';

// Pilot tenant seeded by apps/api/scripts/seed-staging.ts
export const TENANT_SLUG = __ENV.TENANT_SLUG || 'dev-school';
export const TENANT_ID = __ENV.TENANT_ID || 'a1b2c3d4-0000-0000-0000-000000000001';

// System/root tenant seeded by apps/api/scripts/seed-admin.ts (holds SUPER_ADMIN)
export const SYSTEM_TENANT_ID = __ENV.SYSTEM_TENANT_ID || 'a1b2c3d4-0000-0000-0000-000000000000';

// Pilot users (from seed-staging.ts) — same password for all four
const PILOT_PASSWORD = __ENV.PILOT_PASSWORD || 'PilotUser123!';

export const CREDENTIALS = {
    SCHOOL_ADMIN: { email: __ENV.ADMIN_EMAIL || 'admin@pilot.edulanka.lk', password: PILOT_PASSWORD, tenantId: TENANT_ID },
    TEACHER: { email: __ENV.TEACHER_EMAIL || 'teacher@pilot.edulanka.lk', password: PILOT_PASSWORD, tenantId: TENANT_ID },
    STUDENT: { email: __ENV.STUDENT_EMAIL || 'student@pilot.edulanka.lk', password: PILOT_PASSWORD, tenantId: TENANT_ID },
    PARENT: { email: __ENV.PARENT_EMAIL || 'parent@pilot.edulanka.lk', password: PILOT_PASSWORD, tenantId: TENANT_ID },
    SUPER_ADMIN: {
        email: __ENV.SUPER_ADMIN_EMAIL || 'superadmin@edulanka.lk',
        password: __ENV.SUPER_ADMIN_PASSWORD || 'SystemAdmin123!',
        tenantId: SYSTEM_TENANT_ID,
    },
};

// Stage sizing — override with -e SCALE=0.25 etc. to shrink/grow the whole run
export const SCALE = Number(__ENV.SCALE || 1);
export const scaled = (n) => Math.max(1, Math.round(n * SCALE));

export const TEST_RUN_ID = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
