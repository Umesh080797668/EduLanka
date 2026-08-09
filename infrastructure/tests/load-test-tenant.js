import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
};

export default function () {
    const payload = JSON.stringify({
        name: 'Load Test School ' + __VU + '-' + __ITER,
        slug: 'load-test-' + __VU + '-' + __ITER,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${__ENV.SUPER_ADMIN_TOKEN || 'placeholder'}`,
        },
    };

    // Targeting the Nginx gateway or API directly on 8081
    const res = http.post('http://localhost:8081/api/v1/tenants', payload, params);

    check(res, {
        'is status 201': (r) => r.status === 201,
    });

    sleep(1);
}
