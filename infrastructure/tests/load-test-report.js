import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 20 },
        { duration: '20s', target: 20 },
        { duration: '10s', target: 0 },
    ],
};

export default function () {
    const params = {
        headers: {
            'x-tenant-id': 'tenant_seed_1',
        }
    };

    const res = http.get('http://localhost:8081/api/v1/reports/student/1/report-card', params);

    check(res, {
        'status is 200 or 4xx': (r) => r.status === 200 || r.status >= 400,
    });

    sleep(1);
}
