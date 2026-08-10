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
            'x-tenant-id': 'a1b2c3d4-0000-0000-0000-000000000001',
            'Authorization': `Bearer ${__ENV.SUPER_ADMIN_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdXBlci1hZG1pbi1pZCIsInJvbGUiOiJTVVBFUl9BRE1JTiIsInRlbmFudElkIjoiYTFiMmMzZDQtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAxIiwiaWF0IjoxNzg2MzMzODM3LCJleHAiOjE3ODYzMzc0Mzd9.AxfjpANbx9T1OkEag8gYbWSyPXQOQsJ8KYi9m3yGj5k'}`,
        }
    };

    const res = http.get('http://localhost:8081/api/v1/report-cards/student/123e4567-e89b-12d3-a456-426614174000/term/1/year/2023/download', params);

    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    sleep(1);
}
