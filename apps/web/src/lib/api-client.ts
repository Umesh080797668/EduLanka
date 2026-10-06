import { authManager } from '@/lib/auth-store';
import type { ApiResponse } from '@edu-lanka/shared-types';

// If running purely in the browser, we actively WANT to use a relative url to hit the Next.js rewrite proxy.
// This beautifully avoids CORS errors since the browser only communicates with the same origin.
const API_BASE_URL = typeof window !== 'undefined'
    ? '/api/v1'
    : (process.env['NEXT_PUBLIC_API_URL'] ?? '');

interface RequestOptions extends RequestInit {
    token?: string;
    tenantId?: string;
    skipGlobalToast?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    if (!refreshPromise) {
        refreshPromise = (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });

                if (!res.ok) {
                    return null;
                }

                const json = await res.json();
                const newAccessToken = json?.data?.accessToken || json?.accessToken;
                if (newAccessToken) {
                    authManager.setToken(newAccessToken);
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('auth:refreshed', { detail: { token: newAccessToken } }));
                    }
                    return newAccessToken;
                }
                return null;
            } catch {
                return null;
            } finally {
                refreshPromise = null;
            }
        })();
    }

    return refreshPromise;
}

/**
 * Typed fetch wrapper targeting the EduLanka NestJS API.
 * Handles auth headers, tenant scoping, and response envelope unwrapping.
 */
async function apiFetch<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const { token, tenantId, headers: extraHeaders, skipGlobalToast, ...rest } = options;

    let finalToken = token;
    let finalTenantId = tenantId;

    if (typeof window !== 'undefined') {
        if (!finalToken) finalToken = authManager.getToken() || undefined;
        if (!finalTenantId) finalTenantId = authManager.getTenantId() || undefined;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(finalTenantId ? { 'X-Tenant-Id': finalTenantId } : {}),
        ...(finalToken ? { Authorization: `Bearer ${finalToken}` } : {}),
        ...(extraHeaders as Record<string, string>),
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        cache: 'no-store',
        ...rest,
        headers,
    });

    if (response.status === 401) {
        const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/refresh');

        if (!isAuthRoute && typeof window !== 'undefined') {
            const newToken = await attemptTokenRefresh();
            if (newToken) {
                return apiFetch<T>(path, {
                    ...options,
                    token: newToken,
                });
            }

            authManager.clearAuth();
            const segment = window.location.pathname.split('/')[1] ?? '';
            const prefix = ['en', 'si', 'ta'].includes(segment) ? `/${segment}` : '';
            window.location.href = `${prefix}/login`;
        }

        throw new Error('Session expired. Please sign in again.');
    }

    let json: ApiResponse<T>;
    try {
        const text = await response.text();
        json = text ? JSON.parse(text) : { success: response.ok, data: null as any };
    } catch {
        json = { success: response.ok, data: null as any };
    }

    if (!response.ok || !json.success) {
        // Enterprise Error Mapping
        let title = 'Request Failed';
        let description = 'An unexpected system error occurred. Please try again or contact support.';

        if (response.status === 400) {
            title = 'Validation Error';
            description = json.error?.message || 'Please check your inputs and try again.';
        } else if (response.status === 401 || response.status === 403) {
            title = 'Access Denied';
            description = json.error?.message || 'You do not have the required permissions.';
        } else if (response.status === 404) {
            title = 'Not Found';
            description = 'The requested resource could not be found.';
        } else if (json.error?.message) {
            description = json.error.message;
        }

        // Only fire the global toast if not skipped by the page-level logic
        if (typeof window !== 'undefined' && !skipGlobalToast) {
            import('sonner').then(({ toast }) => {
                toast.error(title, { description });
            });
        }

        const apiErr: any = new Error(json.error?.message ?? `HTTP ${response.status}: ${title}`);
        apiErr.code = json.error?.code;
        apiErr.details = json.error?.details;
        throw apiErr;
    }

    return json.data as T;
}

export { attemptTokenRefresh };
export const apiClient = {
    get: <T>(path: string, options?: RequestOptions) =>
        apiFetch<T>(path, { method: 'GET', ...options }),

    post: <T>(path: string, body: unknown, options?: RequestOptions) =>
        apiFetch<T>(path, {
            method: 'POST',
            body: JSON.stringify(body),
            ...options,
        }),

    patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
        apiFetch<T>(path, {
            method: 'PATCH',
            body: JSON.stringify(body),
            ...options,
        }),

    delete: <T>(path: string, options?: RequestOptions) =>
        apiFetch<T>(path, { method: 'DELETE', ...options }),
};
