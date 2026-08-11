import { sleep } from 'k6';
import { post, get } from './http.js';
import { TEST_RUN_ID } from './config.js';

/**
 * SUPER_ADMIN provisioning a brand-new school tenant — the single heaviest
 * write in the system (spins up a whole Postgres schema per call). Kept as a
 * low-VU ramping spike, not sustained load, mirroring real signup patterns.
 */
export function tenantProvisionFlow(data) {
    const session = data.superAdminSession;
    const uniq = `${__VU}-${__ITER}-${TEST_RUN_ID}`;

    post('/tenants', session, {
        name: `Load Test School ${uniq}`,
        slug: `lt-${uniq}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40),
        schoolType: 'TYPE_2',
        contactEmail: `lt.${uniq}@loadtest.edulanka.lk`,
        plan: 'FREE',
    }, { name: 'super_admin_create_tenant', expectedStatuses: [201, 400, 409] });

    sleep(0.5);

    get('/tenants/stats', session, { name: 'super_admin_tenant_stats', expectedStatuses: [200, 404] });
    get('/tenants', session, { name: 'super_admin_list_tenants' });

    sleep(2 + Math.random() * 2);
}
