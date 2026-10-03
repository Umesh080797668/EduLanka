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
});
