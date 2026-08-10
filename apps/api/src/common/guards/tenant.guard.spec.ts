import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
    let guard: TenantGuard;
    let mockContext: { switchToHttp: jest.Mock };

    beforeEach(() => {
        guard = new TenantGuard();
        mockContext = {
            switchToHttp: jest.fn(),
        };
    });

    const createMockContext = (user: any, headers: Record<string, string | string[]> = {}) => {
        const req = {
            user,
            headers,
        };
        mockContext.switchToHttp.mockReturnValue({
            getRequest: () => req,
        });
        return mockContext as unknown as ExecutionContext;
    };

    it('should throw ForbiddenException if user is missing', () => {
        const context = createMockContext(null);

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow('No authenticated user found');
    });

    it('should return true if no x-tenant-id header is provided', () => {
        const context = createMockContext({ id: 1, tenantId: 'tenant-a' });

        expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException if x-tenant-id is an array', () => {
        const context = createMockContext(
            { id: 1, tenantId: 'tenant-a' },
            { 'x-tenant-id': ['tenant-a', 'tenant-b'] },
        );

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow('Invalid x-tenant-id header');
    });

    it('should return true if x-tenant-id matches the user tenantId', () => {
        const context = createMockContext(
            { id: 1, tenantId: 'tenant-a', role: 'STUDENT' },
            { 'x-tenant-id': 'tenant-a' },
        );

        expect(guard.canActivate(context)).toBe(true);
    });

    it('should throw ForbiddenException if x-tenant-id does not match the user tenantId and user is NOT SUPER_ADMIN', () => {
        const context = createMockContext(
            { id: 1, tenantId: 'tenant-a', role: 'STUDENT' },
            { 'x-tenant-id': 'tenant-b' },
        );

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow(
            'You are not permitted to access resources of this tenant',
        );
    });

    it('should return true if x-tenant-id does not match but user is SUPER_ADMIN (Bypass)', () => {
        const context = createMockContext(
            { id: 99, tenantId: 'tenant-admin', role: 'SUPER_ADMIN' },
            { 'x-tenant-id': 'tenant-b' }, // Requesting resources for a different tenant
        );

        expect(guard.canActivate(context)).toBe(true);
    });
});
