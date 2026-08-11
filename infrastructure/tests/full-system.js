// =============================================================================
// EduLanka — Comprehensive System Load Test
// =============================================================================
// Exercises every Phase-1 subsystem concurrently, in proportions that mirror
// real school-day traffic: many students/parents reading, a handful of
// teachers writing marks, one admin doing setup work, and rare
// super-admin tenant provisioning — plus a dedicated scenario that proves
// tenant isolation and RBAC hold under concurrent load, not just in isolation.
//
// RUN:
//   cd infrastructure/tests/k6
//   k6 run full-system.js
//
// AGAINST STAGING / PROD-LIKE ENV:
//   k6 run \
//     -e BASE_URL=https://staging-api.edulanka.lk/api/v1 \
//     -e TENANT_ID=<tenant-uuid> -e TENANT_SLUG=<slug> \
//     -e SUPER_ADMIN_EMAIL=... -e SUPER_ADMIN_PASSWORD=... \
//     -e ADMIN_EMAIL=... -e TEACHER_EMAIL=... -e STUDENT_EMAIL=... -e PARENT_EMAIL=... \
//     -e PILOT_PASSWORD=... \
//     full-system.js
//
// SCALE UP/DOWN (multiplies every VU count):
//   k6 run -e SCALE=3 -e DURATION=10m full-system.js
//
// SMOKE TEST (fast sanity check before a real run):
//   k6 run -e SCALE=0.2 -e DURATION=30s full-system.js
// =============================================================================

import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

import { BASE_URL, scaled } from './config.js';
import { loginAs } from './auth.js';
import { get, post, safeJson } from './http.js';

import { authFlow } from './auth-flow.js';
import { schoolAdminFlow } from './school-admin-flow.js';
import { teacherFlow } from './teacher-flow.js';
import { studentFlow } from './student-flow.js';
import { parentFlow } from './parent-flow.js';
import { tenantProvisionFlow } from './tenant-provisioning-flow.js';
import { securityBoundaryFlow } from './security-boundary-flow.js';

// Non-2xx responses we deliberately provoke (403 isolation checks, 404 on a
// report card that hasn't been generated yet, 409 on duplicate create) are
// business outcomes, not transport failures — don't let them pollute k6's
// built-in http_req_failed metric. Our own `edulanka_api_errors` metric
// (lib/http.js) tracks *unexpected* status codes per endpoint instead.
http.setResponseCallback(http.expectedStatuses(200, 201, 204, 400, 401, 403, 404, 409));

const DURATION = __ENV.DURATION || '3m';

export const options = {
    scenarios: {
        // ── Session churn — every role logs in/refreshes/logs out repeatedly ──
        auth_churn: {
            executor: 'constant-vus',
            exec: 'authFlow',
            vus: scaled(5),
            duration: DURATION,
            startTime: '45s',
            tags: { flow: 'auth' },
        },

        // ── School Admin — write-heavy setup workflows ──
        school_admin_ops: {
            executor: 'constant-vus',
            exec: 'schoolAdminFlow',
            vus: scaled(3),
            duration: DURATION,
            startTime: '45s',
            tags: { flow: 'school_admin' },
        },

        // ── Teachers — moderate read, steady marks-entry writes ──
        teacher_ops: {
            executor: 'constant-vus',
            exec: 'teacherFlow',
            vus: scaled(8),
            duration: DURATION,
            startTime: '45s',
            tags: { flow: 'teacher' },
        },

        // ── Students — highest volume, mostly reads + report-card downloads ──
        student_ops: {
            executor: 'ramping-vus',
            exec: 'studentFlow',
            startVUs: 0,
            startTime: '45s',
            stages: [
                { duration: '30s', target: scaled(40) },
                { duration: DURATION, target: scaled(40) },
                { duration: '20s', target: 0 },
            ],
            tags: { flow: 'student' },
        },

        // ── Parents — second-highest volume, reads only ──
        parent_ops: {
            executor: 'ramping-vus',
            exec: 'parentFlow',
            startVUs: 0,
            startTime: '45s',
            stages: [
                { duration: '30s', target: scaled(25) },
                { duration: DURATION, target: scaled(25) },
                { duration: '20s', target: 0 },
            ],
            tags: { flow: 'parent' },
        },

        // ── Tenant provisioning — rare, heaviest single write (spike, not sustained) ──
        tenant_provisioning: {
            executor: 'ramping-vus',
            exec: 'tenantProvisionFlow',
            startVUs: 0,
            stages: [
                { duration: '10s', target: scaled(5) },
                { duration: '20s', target: scaled(5) },
                { duration: '5s', target: 0 },
            ],
            startTime: '0s',
            tags: { flow: 'tenant_provisioning' },
        },

        // ── Security boundary checks — sustained, low-VU, runs the whole time ──
        security_boundaries: {
            executor: 'constant-vus',
            exec: 'securityBoundaryFlow',
            vus: scaled(3),
            duration: DURATION,
            startTime: '45s',
            tags: { flow: 'security' },
        },
    },

    thresholds: {
        // Overall transport health (excludes the deliberately-provoked codes above)
        http_req_failed: ['rate<0.02'],
        http_req_duration: ['p(95)<1500', 'p(99)<3000'],

        // Our own business-outcome error rate must stay near zero
        edulanka_api_errors: ['rate<0.03'],

        // Security boundary checks must NEVER fail — zero tolerance
        'checks{flow:security}': ['rate==1'],

        // Per-flow latency budgets — the report-card PDF path is allowed more
        // headroom since it's a generation endpoint, not a simple read
        'edulanka_api_duration{name:student_download_report_card}': ['p(95)<3000'],
        'edulanka_api_duration{name:parent_download_report_card}': ['p(95)<3000'],
        'edulanka_api_duration{name:auth_login}': ['p(95)<800'],
        'edulanka_api_duration{name:super_admin_create_tenant}': ['p(95)<5000'],
    },
};

// -----------------------------------------------------------------------------
// setup() — runs ONCE before any VU starts. Logs in every role a single time
// (tokens are shared read-only across VUs, same as sessions on a real device)
// and discovers real seeded IDs so writes reference valid foreign keys
// instead of hardcoded UUIDs that only work against one specific dataset.
// -----------------------------------------------------------------------------
export function setup() {
    console.log(`Target: ${BASE_URL}`);

    const adminSession = loginAs('SCHOOL_ADMIN');
    const teacherSession = loginAs('TEACHER');
    const studentSession = loginAs('STUDENT');
    const parentSession = loginAs('PARENT');
    const superAdminSession = loginAs('SUPER_ADMIN');

    // Discover a real grade/class/student/teacher id to write against
    const gradesRes = get('/grades', adminSession, { name: 'setup_list_grades', expectedStatuses: [200, 201, 204, 403, 404, 500] });
    const seedGradeId = safeJson(gradesRes)?.[0]?.id;

    const classesRes = get('/classes', adminSession, { name: 'setup_list_classes' });
    const seedClassId = safeJson(classesRes)?.[0]?.id;

    const studentsRes = get('/students', adminSession, { name: 'setup_list_students' });
    const seedStudentId = safeJson(studentsRes)?.[0]?.id;

    const teachersRes = get('/teachers', adminSession, { name: 'setup_list_teachers' });
    const seedTeacherId = safeJson(teachersRes)?.[0]?.id;

    check(null, {
        'setup discovered at least one seeded class/student/teacher for write tests': () =>
            !!(seedClassId || seedStudentId || seedTeacherId),
    });

    return {
        adminSession,
        teacherSession,
        studentSession,
        parentSession,
        superAdminSession,
        systemTenantId: superAdminSession.tenantId,
        seedGradeId,
        seedClassId,
        seedStudentId,
        seedTeacherId,
    };
}

// -----------------------------------------------------------------------------
// Scenario entry points (k6 calls these by name via `exec:` above)
// -----------------------------------------------------------------------------
export { authFlow, schoolAdminFlow, teacherFlow, studentFlow, parentFlow, tenantProvisionFlow, securityBoundaryFlow };

// -----------------------------------------------------------------------------
// teardown() — best-effort logout of the shared sessions
// -----------------------------------------------------------------------------
export function teardown(data) {
    for (const session of [data.adminSession, data.teacherSession, data.studentSession, data.parentSession]) {
        post('/auth/logout', session, { refreshToken: session.refreshToken }, {
            name: 'teardown_logout',
            expectedStatuses: [204, 401],
        });
    }
}

// -----------------------------------------------------------------------------
// Readable console + JSON summary artifact
// -----------------------------------------------------------------------------
export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data, null, 2),
    };
}
