import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Logger,
    Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { BillingService } from '../../modules/billing/billing.service';
import type { AppConfiguration } from '../../config/configuration';

/**
 * Blueprint Section 7c Account Lock Guard:
 * When an institutional tenant has overdue invoices past the 14-day grace period,
 * write operations (POST, PUT, PATCH, DELETE) are locked across portals.
 * Read operations (GET, HEAD, OPTIONS) remain unlocked so administrators can view data
 * and navigate to billing to settle outstanding balances.
 * Authentication, Health, Billing, Super Admin operations, Disaster Mode activation,
 * Emergency SMS, and Mobile sync pushes are exempt.
 */
@Injectable()
export class AccountLockGuard implements CanActivate {
    private readonly logger = new Logger(AccountLockGuard.name);

    private static readonly EXEMPT_PREFIXES = [
        '/api/v1/auth',
        '/auth',
        '/api/v1/health',
        '/health',
        '/api/v1/billing',
        '/billing',
        '/api/v1/docs',
        '/docs',
        '/api-docs',
        // Disaster Mode activation & emergency safety operations
        '/api/v1/tenants/disaster-mode',
        '/tenants/disaster-mode',
        // Emergency SMS & disaster alerts
        '/api/v1/sms',
        '/sms',
        '/api/v1/mobile/test-disaster-push',
        '/api/v1/mobile/emergency-contacts',
        '/api/v1/mobile/shelters',
        // Mobile sync pushes (prevent loss of offline attendance and homework)
        '/api/v1/mobile/sync-events',
        '/mobile/sync-events',
        '/api/v1/sync',
    ];

    constructor(
        private readonly billingService: BillingService,
        @Optional() private readonly configService?: ConfigService<AppConfiguration>,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const method = (request.method || 'GET').toUpperCase();

        // 1. Allow read-only HTTP methods
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return true;
        }

        // 2. Extract pathname cleanly without query strings (prevents query-string bypasses)
        const rawUrl = (request as any).originalUrl || request.url || '';
        const pathname = (rawUrl.split('?')[0] || '').toLowerCase();
        const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

        // 3. Allow exempt paths (auth, health, billing, docs, disaster-mode, emergency sms, sync)
        if (AccountLockGuard.EXEMPT_PREFIXES.some(prefix => normalizedPath === prefix || normalizedPath.startsWith(prefix + '/'))) {
            return true;
        }

        // 4. Resolve authenticated user or verified token role for SUPER_ADMIN bypass
        let user = (request as any).user;
        if (!user && request.headers.authorization?.startsWith('Bearer ')) {
            const token = request.headers.authorization.slice(7).trim();
            const jwtSecret = this.configService?.get('jwt.secret', { infer: true }) || process.env.JWT_SECRET;
            try {
                user = jwtSecret ? (jwt.verify(token, jwtSecret) as any) : (jwt.decode(token) as any);
            } catch {
                // Handled downstream by JwtAuthGuard
            }
        }

        // 5. Super Admins bypass tenant payment locks
        if (user && user.role === 'SUPER_ADMIN') {
            return true;
        }

        // 6. Resolve tenant identifier from verified tenantContext (fallback to request.user?.tenantId for unit test mocks)
        // DO NOT trust unverified client-sent x-tenant-id header
        const tenantId = request.tenantContext?.tenantId || user?.tenantId;
        if (!tenantId || typeof tenantId !== 'string') {
            return true;
        }

        // 7. Query tenant invoice & grace period status (BillingService implements TTL caching)
        try {
            const status = await this.billingService.checkTenantInvoiceStatus(tenantId);
            if (status.isAccountLocked) {
                this.logger.warn(
                    `Rejected ${method} ${rawUrl} for locked tenant ${tenantId}. Unpaid invoice grace period expired.`,
                );
                throw new ForbiddenException(
                    status.message ||
                    'Account is locked due to unpaid invoices past the 14-day grace period. Write operations are disabled.',
                );
            }
        } catch (err) {
            if (err instanceof ForbiddenException) throw err;
            // If checking fails due to temporary DB error, log warning
            this.logger.warn(`Could not verify account lock status for tenant ${tenantId}: ${(err as any)?.message}`);
        }

        return true;
    }
}
