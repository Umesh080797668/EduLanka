import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BillingService } from '../../modules/billing/billing.service';

/**
 * Blueprint Section 7c Account Lock Guard:
 * When an institutional tenant has overdue invoices past the 14-day grace period,
 * write operations (POST, PUT, PATCH, DELETE) are locked across portals.
 * Read operations (GET, HEAD, OPTIONS) remain unlocked so administrators can view data
 * and navigate to billing to settle outstanding balances.
 * Authentication, Health, Billing, and Super Admin operations are exempt.
 */
@Injectable()
export class AccountLockGuard implements CanActivate {
    private readonly logger = new Logger(AccountLockGuard.name);

    constructor(private readonly billingService: BillingService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const method = (request.method || 'GET').toUpperCase();

        // 1. Allow read-only HTTP methods
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return true;
        }

        const url = request.url || '';

        // 2. Allow exempt paths (auth, health, billing, API documentation)
        if (
            url.includes('/auth') ||
            url.includes('/health') ||
            url.includes('/billing') ||
            url.includes('/docs')
        ) {
            return true;
        }

        const user = (request as any).user;

        // 3. Super Admins bypass tenant payment locks
        if (user && user.role === 'SUPER_ADMIN') {
            return true;
        }

        // 4. Resolve tenant identifier
        const tenantId = user?.tenantId || (request.headers['x-tenant-id'] as string | undefined);
        if (!tenantId || typeof tenantId !== 'string') {
            return true;
        }

        // 5. Query tenant invoice & grace period status
        try {
            const status = await this.billingService.checkTenantInvoiceStatus(tenantId);
            if (status.isAccountLocked) {
                this.logger.warn(
                    `Rejected ${method} ${url} for locked tenant ${tenantId}. Unpaid invoice grace period expired.`,
                );
                throw new ForbiddenException(
                    status.message ||
                    'Account is locked due to unpaid invoices past the 14-day grace period. Write operations are disabled.',
                );
            }
        } catch (err) {
            if (err instanceof ForbiddenException) throw err;
            // If checking fails due to temporary DB error, fail closed or log
            this.logger.warn(`Could not verify account lock status for tenant ${tenantId}: ${(err as any)?.message}`);
        }

        return true;
    }
}
