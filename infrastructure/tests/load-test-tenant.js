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
        schoolType: 'TYPE_1AB',
        contactEmail: 'admin@loadtest' + __VU + '.edu.lk',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${__ENV.SUPER_ADMIN_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdXBlci1hZG1pbi1pZCIsInJvbGUiOiJTVVBFUl9BRE1JTiIsInRlbmFudElkIjoiYTFiMmMzZDQtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiaWF0IjoxNzg2MzMzODM3LCJleHAiOjE3ODYzMzc0Mzd9.AxfjpANbx9T1OkEag8gYbWSyPXQOQsJ8KYi9m3yGj5k'}`,
        },
    };

    // Targeting the Nginx gateway or API directly on 8081
    const res = http.post('http://localhost:8081/api/v1/tenants', payload, params);

    check(res, {
        'is status 201': (r) => r.status === 201,
    });

    sleep(1);
}
