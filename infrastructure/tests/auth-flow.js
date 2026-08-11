import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, CREDENTIALS } from './config.js';
import { apiDuration, apiErrors } from './http.js';

const ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

/**
 * Simulates real login churn: login → refresh → logout, repeated.
 * This is the endpoint every session on the platform passes through, so it
 * gets its own dedicated, higher-concurrency scenario rather than one login
 * per VU in setup().
 */
export function authFlow() {
    const role = ROLES[Math.floor(Math.random() * ROLES.length)];
    const creds = CREDENTIALS[role];

    // 1. Login
    const loginRes = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email: creds.email, password: creds.password, tenantId: creds.tenantId }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login' } },
    );
    apiDuration.add(loginRes.timings.duration, { name: 'auth_login' });
    const loginOk = check(loginRes, { 'login 200': (r) => r.status === 200 });
    apiErrors.add(!loginOk, { name: 'auth_login' });
    if (!loginOk) { sleep(1); return; }

    const { accessToken, refreshToken } = loginRes.json();
    sleep(Math.random() * 2 + 0.5);

    // 2. Refresh
    const refreshRes = http.post(
        `${BASE_URL}/auth/refresh`,
        JSON.stringify({ refreshToken }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_refresh' } },
    );
    apiDuration.add(refreshRes.timings.duration, { name: 'auth_refresh' });
    const refreshOk = check(refreshRes, { 'refresh 200': (r) => r.status === 200 });
    apiErrors.add(!refreshOk, { name: 'auth_refresh' });

    const newRefreshToken = refreshOk ? refreshRes.json('refreshToken') : refreshToken;
    sleep(Math.random() * 1.5 + 0.5);

    // 3. Logout (revokes refresh token — proves Redis-backed revocation works under load)
    const logoutRes = http.post(
        `${BASE_URL}/auth/logout`,
        JSON.stringify({ refreshToken: newRefreshToken }),
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, tags: { name: 'auth_logout' } },
    );
    apiDuration.add(logoutRes.timings.duration, { name: 'auth_logout' });
    const logoutOk = check(logoutRes, { 'logout 204': (r) => r.status === 204 });
    apiErrors.add(!logoutOk, { name: 'auth_logout' });

    sleep(Math.random() * 2);
}
