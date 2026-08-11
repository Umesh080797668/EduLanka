import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE_URL } from './config.js';

// Custom metrics, broken out per business flow so the summary shows which
// part of the system is slow/failing, not just an aggregate number.
export const apiErrors = new Rate('edulanka_api_errors');
export const apiDuration = new Trend('edulanka_api_duration', true);
export const businessFailures = new Counter('edulanka_business_failures');

/**
 * Fires a tenant-scoped, authenticated request and records standard metrics.
 * @param {string} method GET|POST|PATCH|DELETE
 * @param {string} path   e.g. '/students' (no leading BASE_URL)
 * @param {object} session { accessToken, tenantId }
 * @param {object} [body]
 * @param {object} [opts]  { name: metric tag, expectedStatuses: [200,201,...], overrideTenantId }
 */
export function apiRequest(method, path, session, body, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-tenant-id': opts.overrideTenantId || session.tenantId,
    };

    const params = {
        headers,
        tags: { name: opts.name || `${method} ${path}` },
    };

    const url = `${BASE_URL}${path}`;
    const res = body !== undefined
        ? http.request(method, url, JSON.stringify(body), params)
        : http.request(method, url, null, params);

    apiDuration.add(res.timings.duration, { name: params.tags.name });

    const expected = opts.expectedStatuses || [200, 201, 204];
    const passed = check(res, {
        [`${params.tags.name} → status in ${expected.join('/')}`]: (r) => expected.includes(r.status),
    });

    if (!passed) {
        apiErrors.add(1, { name: params.tags.name });
        businessFailures.add(1, { name: params.tags.name, status: String(res.status) });
    } else {
        apiErrors.add(0, { name: params.tags.name });
    }

    return res;
}

export const get = (path, session, opts) => apiRequest('GET', path, session, undefined, opts);
export const post = (path, session, body, opts) => apiRequest('POST', path, session, body, opts);
export const patch = (path, session, body, opts) => apiRequest('PATCH', path, session, body, opts);
export const del = (path, session, opts) => apiRequest('DELETE', path, session, undefined, opts);

export function safeJson(res) {
    try { return res.json(); } catch { return null; }
}
