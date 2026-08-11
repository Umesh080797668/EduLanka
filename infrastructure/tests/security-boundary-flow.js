import { sleep, check } from 'k6';
import http from 'k6/http';
import { BASE_URL } from './config.js';
import { apiDuration, apiErrors } from './http.js';

/**
 * This scenario should ALWAYS "fail" the business call and succeed the check —
 * it deliberately tries to cross tenant/role boundaries under concurrent load.
 * A regression here (200 instead of 403) is a security incident, not a perf
 * number, which is why it gets threshold=0% tolerance in full-system.js.
 */
export function securityBoundaryFlow(data) {
    const student = data.studentSession;
    const otherTenantId = data.systemTenantId; // student has no business in the system/root tenant

    // 1. Student tries to read another tenant's student list via header override
    const crossTenantRes = http.request('GET', `${BASE_URL}/students`, null, {
        headers: {
            Authorization: `Bearer ${student.accessToken}`,
            'x-tenant-id': otherTenantId,
        },
        tags: { name: 'security_cross_tenant_read' },
    });
    apiDuration.add(crossTenantRes.timings.duration, { name: 'security_cross_tenant_read' });
    const blocked1 = check(crossTenantRes, {
        'cross-tenant read is rejected (403)': (r) => r.status === 403,
    });
    apiErrors.add(!blocked1, { name: 'security_cross_tenant_read' });

    sleep(0.2);

    // 2. Student tries to hit an admin-only endpoint (RBAC boundary)
    const rbacRes = http.request('POST', `${BASE_URL}/auth/signup`, JSON.stringify({
        email: `escalation-attempt-${__VU}-${__ITER}@loadtest.edulanka.lk`,
        password: 'ShouldNotWork123!',
        fullName: 'Escalation Attempt',
        tenantId: student.tenantId,
        role: 'SCHOOL_ADMIN',
    }), {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${student.accessToken}`,
            'x-tenant-id': student.tenantId,
        },
        tags: { name: 'security_role_escalation_attempt' },
    });
    apiDuration.add(rbacRes.timings.duration, { name: 'security_role_escalation_attempt' });
    const blocked2 = check(rbacRes, {
        'role escalation is rejected (403)': (r) => r.status === 403,
    });
    apiErrors.add(!blocked2, { name: 'security_role_escalation_attempt' });

    sleep(1 + Math.random());
}
