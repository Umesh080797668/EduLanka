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
            json: async () => mockData,
        });

        const result = await apiClient.get<{ foo: string }>('/test');
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8081/api/v1/test', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        expect(result).toEqual(mockData.data);
    });

    it('should inject token and tenantId headers if provided', async () => {
        const mockData = { success: true, data: { success: true } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        await apiClient.post('/create', { name: 'test' }, {
            token: 'mock-jwt-token',
            tenantId: 'tenant-xyz'
        });

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:8081/api/v1/create', {
            method: 'POST',
            body: JSON.stringify({ name: 'test' }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-jwt-token',
                'X-Tenant-Id': 'tenant-xyz',
            },
        });
    });

    it('should throw an explicit error if the API envelope indicates a failure', async () => {
        const mockError = { success: false, error: { message: 'Business logic failure', code: 400 } };
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true, // HTTP 200 but logical failure
            json: async () => mockError,
        });

        await expect(apiClient.get('/fail')).rejects.toThrow('Business logic failure');
    });

    it('should throw an explicit error if HTTP OK is false', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
        });

        await expect(apiClient.delete('/server-fail')).rejects.toThrow('API error: 500');
    });
});
