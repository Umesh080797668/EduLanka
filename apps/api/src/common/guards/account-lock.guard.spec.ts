import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { AccountLockGuard } from './account-lock.guard';
import type { BillingService } from '../../modules/billing/billing.service';

describe('AccountLockGuard', () => {
    let guard: AccountLockGuard;
    let mockBillingService: jest.Mocked<Partial<BillingService>>;
    let mockContext: { switchToHttp: jest.Mock };

    beforeEach(() => {
        mockBillingService = {
            checkTenantInvoiceStatus: jest.fn(),
        };
        guard = new AccountLockGuard(mockBillingService as BillingService);
        mockContext = {
            switchToHttp: jest.fn(),
        };
    });

    const createMockContext = (
        method: string,
        url: string,
        user: any,
        headers: Record<string, string | string[]> = {},
        tenantContext?: any,
    ) => {
        const req = {
            method,
            url,
            user,
            headers,
            tenantContext,
        };
        mockContext.switchToHttp.mockReturnValue({
            getRequest: () => req,
        });
        return mockContext as unknown as ExecutionContext;
    };

    it('allows read-only GET requests even if account is locked', async () => {
        const context = createMockContext('GET', '/api/v1/students', { tenantId: 't-1', role: 'SCHOOL_ADMIN' });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('allows billing endpoints for locked tenants to allow settling payment', async () => {
        const context = createMockContext('POST', '/api/v1/billing/status/t-1', { tenantId: 't-1', role: 'SCHOOL_ADMIN' });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN to perform write operations on behalf of tenant via user object', async () => {
        const context = createMockContext('POST', '/api/v1/students', { tenantId: 't-1', role: 'SUPER_ADMIN' });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('allows SUPER_ADMIN to bypass payment lock via decoded JWT when request.user is undefined', async () => {
        const token = jwt.sign({ sub: 'admin-1', role: 'SUPER_ADMIN' }, 'test-secret');
        const context = createMockContext(
            'POST',
            '/api/v1/students',
            undefined, // request.user is empty before JwtAuthGuard
            { authorization: `Bearer ${token}` },
            { tenantId: 't-1', slug: 'demo' },
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('exempts Disaster Mode activation and deactivation from account lock', async () => {
        const context = createMockContext(
            'POST',
            '/api/v1/tenants/disaster-mode/activate',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('exempts emergency SMS and disaster push endpoints from account lock', async () => {
        const context = createMockContext(
            'POST',
            '/api/v1/sms/emergency',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('exempts mobile sync push endpoint so offline attendance & homework are not blocked or lost', async () => {
        const context = createMockContext(
            'POST',
            '/api/v1/mobile/sync-events',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
    });

    it('does NOT exempt routes using query string trickery (e.g. /students?ref=/billing)', async () => {
        (mockBillingService.checkTenantInvoiceStatus as jest.Mock).mockResolvedValueOnce({
            tenantId: 't-1',
            hasOverdueInvoices: true,
            inGracePeriod: false,
            isAccountLocked: true,
            graceDaysRemaining: 0,
            overdueAmountLkr: 15000,
            message: 'Account locked due to overdue invoice',
        });

        const context = createMockContext(
            'POST',
            '/api/v1/students?ref=/billing',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('enforces lock using verified request.tenantContext even when x-tenant-id header is omitted', async () => {
        (mockBillingService.checkTenantInvoiceStatus as jest.Mock).mockResolvedValueOnce({
            tenantId: 't-1',
            hasOverdueInvoices: true,
            inGracePeriod: false,
            isAccountLocked: true,
            graceDaysRemaining: 0,
            overdueAmountLkr: 15000,
            message: 'Account locked due to overdue invoice',
        });

        // Request has NO x-tenant-id header and NO request.user, but middleware set tenantContext
        const context = createMockContext(
            'POST',
            '/api/v1/students',
            undefined,
            {}, // NO x-tenant-id header!
            { tenantId: 't-1', slug: 'demo' },
        );

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
        expect(mockBillingService.checkTenantInvoiceStatus).toHaveBeenCalledWith('t-1');
    });

    it('allows write requests when tenant is in good standing', async () => {
        (mockBillingService.checkTenantInvoiceStatus as jest.Mock).mockResolvedValueOnce({
            tenantId: 't-1',
            hasOverdueInvoices: false,
            inGracePeriod: false,
            isAccountLocked: false,
            graceDaysRemaining: 14,
            overdueAmountLkr: 0,
            message: 'In good standing',
        });

        const context = createMockContext(
            'POST',
            '/api/v1/students',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).toHaveBeenCalledWith('t-1');
    });

    it('allows write requests during the 14-day grace period', async () => {
        (mockBillingService.checkTenantInvoiceStatus as jest.Mock).mockResolvedValueOnce({
            tenantId: 't-1',
            hasOverdueInvoices: true,
            inGracePeriod: true,
            isAccountLocked: false,
            graceDaysRemaining: 8,
            overdueAmountLkr: 5000,
            message: 'In grace period',
        });

        const context = createMockContext(
            'POST',
            '/api/v1/students',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
    });

    it('throws ForbiddenException on write requests when account is locked', async () => {
        (mockBillingService.checkTenantInvoiceStatus as jest.Mock).mockResolvedValueOnce({
            tenantId: 't-1',
            hasOverdueInvoices: true,
            inGracePeriod: false,
            isAccountLocked: true,
            graceDaysRemaining: 0,
            overdueAmountLkr: 15000,
            message: 'Account locked due to overdue invoice',
        });

        const context = createMockContext(
            'POST',
            '/api/v1/students',
            undefined,
            {},
            { tenantId: 't-1', slug: 'demo' },
        );
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
});
