import { TenantContextMiddleware } from '../tenant-context.middleware';
import { Logger, BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
    })
}));

import { createClient } from '@supabase/supabase-js';

describe('TenantContextMiddleware', () => {
    let middleware: TenantContextMiddleware;
    let mockConfigService: any;
    let mockRequest: any;
    let mockNext: any;
    let mockSupabase: any;

    beforeEach(() => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
        mockConfigService = {
            get: jest.fn().mockReturnValue('mock-val'),
        };

        middleware = new TenantContextMiddleware(mockConfigService as any);
        mockSupabase = (createClient as jest.Mock)();

        mockRequest = {
            headers: {},
            originalUrl: '/api/v1/some-route',
            method: 'GET',
        };

        mockNext = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('should skip processing for health, auth, docs', async () => {
        mockRequest.originalUrl = '/api/v1/auth/login';
        await middleware.use(mockRequest, {}, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRequest.tenantContext).toBeUndefined();
    });

    it('should skip processing for super admin tenant routes', async () => {
        mockRequest.originalUrl = '/api/v1/tenants';
        mockRequest.method = 'POST';
        await middleware.use(mockRequest, {}, mockNext);
        expect(mockNext).toHaveBeenCalled();
        expect(mockRequest.tenantContext).toBeUndefined();
    });

    it('should throw BadRequestException if x-tenant-id is missing', async () => {
        await expect(middleware.use(mockRequest, {}, mockNext)).rejects.toThrow(BadRequestException);
    });

    it('should fetch and cache context for active tenant', async () => {
        mockRequest.headers['x-tenant-id'] = 'tenant-123';
        mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: { id: 'tenant-123', slug: 'dev-school', plan: 'FREE', status: 'ACTIVE' },
            error: null
        });

        await middleware.use(mockRequest, {}, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRequest.tenantContext).toBeDefined();
        expect(mockRequest.tenantContext.slug).toBe('dev-school');
        expect(mockRequest.tenantContext.schemaName).toBe('tenant_dev-school');

        // Second call should use cache (no extra db hit)
        mockSupabase.maybeSingle.mockClear();
        await middleware.use(mockRequest, {}, mockNext);
        expect(mockSupabase.maybeSingle).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if tenant lookup fails', async () => {
        // clear cache bypass logic for tests - use fresh id
        mockRequest.headers['x-tenant-id'] = 'tenant-fail';
        mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db fail' } });

        await expect(middleware.use(mockRequest, {}, mockNext)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if tenant not found', async () => {
        mockRequest.headers['x-tenant-id'] = 'tenant-missing';
        mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

        await expect(middleware.use(mockRequest, {}, mockNext)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if tenant is not ACTIVE', async () => {
        mockRequest.headers['x-tenant-id'] = 'tenant-suspended';
        mockSupabase.maybeSingle.mockResolvedValueOnce({
            data: { id: 'tenant-suspended', slug: 'dev', status: 'SUSPENDED' },
            error: null
        });

        await expect(middleware.use(mockRequest, {}, mockNext)).rejects.toThrow(BadRequestException);
    });
});
