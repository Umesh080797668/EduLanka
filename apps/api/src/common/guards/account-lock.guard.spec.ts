import type { ExecutionContext} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
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
    ) => {
        const req = {
            method,
            url,
            user,
            headers,
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

    it('allows SUPER_ADMIN to perform write operations on behalf of tenant', async () => {
        const context = createMockContext('POST', '/api/v1/students', { tenantId: 't-1', role: 'SUPER_ADMIN' });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(mockBillingService.checkTenantInvoiceStatus).not.toHaveBeenCalled();
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

        const context = createMockContext('POST', '/api/v1/students', { tenantId: 't-1', role: 'SCHOOL_ADMIN' });
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

        const context = createMockContext('POST', '/api/v1/students', { tenantId: 't-1', role: 'SCHOOL_ADMIN' });
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

        const context = createMockContext('POST', '/api/v1/students', { tenantId: 't-1', role: 'SCHOOL_ADMIN' });
        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
});
