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
        ...(extraHeaders as Record<string, string>),
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'include',
        cache: 'no-store',
        ...rest,
        headers,
    });

    if (response.status === 401) {
        if (typeof window !== 'undefined') {
            authManager.clearAuth();
            window.location.href = '/auth/login';
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

        throw new Error(json.error?.message ?? `HTTP ${response.status}: ${title}`);
    }

    return json.data as T;
}

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
