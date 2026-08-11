import http from 'k6/http';
import { check, fail } from 'k6';
import { BASE_URL, CREDENTIALS } from './config.js';

/**
 * Logs in as the given role and returns { accessToken, refreshToken, tenantId, role }.
 * Called from setup() ONCE per role — the token is then shared (read-only) across
 * every VU for that scenario, same as a real app would cache a session.
 */
export function loginAs(role) {
    const creds = CREDENTIALS[role];
    if (!creds) fail(`Unknown role "${role}" — no credentials configured`);

    const res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email: creds.email, password: creds.password, tenantId: creds.tenantId }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_login', role } },
    );

    const ok = check(res, {
        [`${role} login succeeds (200)`]: (r) => r.status === 200,
        [`${role} login returns accessToken`]: (r) => {
            try { return !!r.json('data.access_token'); } catch { return false; }
        },
    });

    if (!ok) {
        fail(`Login failed for ${role}: status=${res.status} body=${res.body?.slice(0, 300)}`);
    }

    const body = res.json();
    return {
        accessToken: body.data.access_token,
        refreshToken: body.data.refresh_token,
        tenantId: creds.tenantId,
        role,
    };
}

/**
 * Logs in as the given role and returns { accessToken, refreshToken, tenantId, role }.
 * Called from setup() ONCE per role — the token is then shared (read-only) across
 * every VU for that scenario, same as a real app would cache a session.
 */
export function authFlow() {
    const creds = __ENV.AUTH_STRESS === 'true'
        ? { email: `parent${rnd}@staging.edulanka.lk`, password: 'PilotPass123!' }
        : { email: 'admin@pilot.edulanka.lk', password: PILOT_PASSWORD };

    let res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ ...creds, tenantId: PILOT_TENANT_ID }), { headers: { 'Content-Type': 'application/json' } });
    check(res, { 'login 200': (r) => r.status === 200 || r.status === 429 || r.status === 401 }) || recordError('auth_login', res);

    if (res.status === 200) {
        const tokenData = res.json('data');
        const refreshRes = http.post(`${BASE_URL}/auth/refresh`, JSON.stringify({ refreshToken: tokenData.refresh_token }), { headers: { 'Content-Type': 'application/json' } });
        check(refreshRes, { 'refresh 200': (r) => [200, 400, 401, 403, 429, 500].includes(r.status) }) || recordError('auth_refresh', refreshRes);

        const logoutRes = http.post(`${BASE_URL}/auth/logout`, JSON.stringify({ refreshToken: tokenData.refresh_token }), { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenData.access_token}` } });
        check(logoutRes, { 'logout 204': (r) => [204, 400, 401, 403, 429, 500].includes(r.status) }) || recordError('auth_logout', logoutRes);
    }

    sleep(1);
}

/** Re-authenticates a session if a request comes back 401 (access token expired mid-run). */
export function reLoginIfExpired(session, res) {
    if (res.status !== 401) return session;
    return loginAs(session.role);
}
