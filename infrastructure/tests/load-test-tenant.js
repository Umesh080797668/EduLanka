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
        },
    };

    // Targeting the Nginx gateway or API directly on 8081
    const res = http.post('http://localhost:8081/api/v1/tenants', payload, params);

    check(res, {
        'is status 201 or 4xx': (r) => r.status === 201 || r.status >= 400,
    });

    sleep(1);
}
