import { apiClient } from '../api-client';

// Mock the global fetch function
global.fetch = jest.fn();

describe('apiClient', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should perform a simple GET request correctly', async () => {
        const mockData = { success: true, data: { foo: 'bar' } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(mockData),
        });

        const result = await apiClient.get<{ foo: string }>('/test');
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/test', expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
            }),
        }));
        expect(result).toEqual(mockData.data);
    });

    it('should inject token and tenantId headers if provided', async () => {
        const mockData = { success: true, data: { success: true } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify(mockData),
        });

        await apiClient.post('/create', { name: 'test' }, {
            token: 'mock-jwt-token',
            tenantId: 'tenant-xyz'
        });

        expect(global.fetch).toHaveBeenCalledWith('/api/v1/create', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ name: 'test' }),
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-jwt-token',
                'X-Tenant-Id': 'tenant-xyz',
            }),
        }));
    });

    it('should throw an explicit error if the API envelope indicates a failure', async () => {
        const mockError = { success: false, error: { message: 'Business logic failure', code: 400 } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true, // HTTP 200 but logical failure
            status: 200,
            text: async () => JSON.stringify(mockError),
        });

        await expect(apiClient.get('/fail')).rejects.toThrow('Business logic failure');
    });

    it('should throw an explicit error if HTTP OK is false', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ error: { message: 'Internal Server Error' } }),
        });

        await expect(apiClient.delete('/server-fail')).rejects.toThrow('Internal Server Error');
    });

    it('should attempt token refresh once on 401 and retry original request', async () => {
        // 1st request gets 401
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => JSON.stringify({ error: { message: 'Token expired' } }),
        });
        // 2nd request is POST /auth/refresh
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { accessToken: 'new-refreshed-jwt' } }),
        });
        // 3rd request is the retried original request with new token
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true, data: { status: 'success after refresh' } }),
        });

        const result = await apiClient.get<{ status: string }>('/protected-data');

        expect(result).toEqual({ status: 'success after refresh' });
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/auth/refresh', expect.objectContaining({
            method: 'POST',
            credentials: 'include',
        }));
        expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/v1/protected-data', expect.objectContaining({
            headers: expect.objectContaining({
                Authorization: 'Bearer new-refreshed-jwt',
            }),
        }));
    });

    it('should retry on HTTP 429 and succeed on subsequent attempt', async () => {
        jest.useFakeTimers();

        // 1st request gets 429
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 429,
            headers: {
                get: (h: string) => (h.toLowerCase() === 'retry-after' ? '1' : null),
            },
            text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
        });

        // 2nd request succeeds
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true, data: { rateLimited: false } }),
        });

        const promise = apiClient.get<{ rateLimited: boolean }>('/limited-data');

        // Advance timers for backoff delay
        await jest.advanceTimersByTimeAsync(1100);

        const result = await promise;
        expect(result).toEqual({ rateLimited: false });
        expect(global.fetch).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
    });

    it('should fail after exceeding maxRetries on HTTP 429', async () => {
        jest.useFakeTimers();

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 429,
            headers: {
                get: () => '0',
            },
            text: async () => JSON.stringify({ error: { message: 'Too many requests, slow down' } }),
        });

        const promise = apiClient.get('/always-limited', { maxRetries: 2 });
        const assertion = expect(promise).rejects.toThrow('Too many requests, slow down');

        // Advance timers through all retries
        await jest.advanceTimersByTimeAsync(5000);

        await assertion;
        // Initial request + 2 retries = 3 calls
        expect(global.fetch).toHaveBeenCalledTimes(3);

        jest.useRealTimers();
    });
});
