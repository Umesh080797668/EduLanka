import type { ApiResponse } from '@edu-lanka/shared-types';

// If running purely in the browser, we actively WANT to use a relative url to hit the Next.js rewrite proxy.
// This beautifully avoids CORS errors since the browser only communicates with the same origin.
const API_BASE_URL = typeof window !== 'undefined'
    ? '/api/v1'
    : (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8081/api/v1');

interface RequestOptions extends RequestInit {
    token?: string;
    tenantId?: string;
}

/**
 * Typed fetch wrapper targeting the EduLanka NestJS API.
 * Handles auth headers, tenant scoping, and response envelope unwrapping.
 */
async function apiFetch<T>(
    path: string,
    options: RequestOptions = {},
): Promise<T> {
    const { token, tenantId, headers: extraHeaders, ...rest } = options;

    let finalToken = token;
    let finalTenantId = tenantId;

    if (typeof window !== 'undefined') {
        if (!finalToken) finalToken = localStorage.getItem('token') || undefined;
        if (!finalTenantId) finalTenantId = localStorage.getItem('tenantId') || undefined;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(finalToken ? { Authorization: `Bearer ${finalToken}` } : {}),
        ...(finalTenantId ? { 'X-Tenant-Id': finalTenantId } : {}),
        ...(extraHeaders as Record<string, string>),
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
                    credentials: 'include',
        cache: 'no-store',
        ...rest,
        headers,
    });

    let json: ApiResponse<T>;
    try {
        const text = await response.text();
        json = text ? JSON.parse(text) as ApiResponse<T> : { success: response.ok, data: null as any };
    } catch {
        json = { success: response.ok, data: null as any };
    }

    if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? `API error: ${response.status}`);
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
