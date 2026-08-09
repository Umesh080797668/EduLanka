import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/**
 * Ensures the authenticated user's tenantId matches the
 * `x-tenant-id` request header. Prevents cross-tenant data access.
 *
 * Usage: Apply after JwtAuthGuard — JWT must already be validated.
 */
@Injectable()
export class TenantGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('No authenticated user found');
        }

        const requestedTenantId = request.headers['x-tenant-id'];

        if (!requestedTenantId) {
            // If no header is sent, scope to the user's own tenant
            return true;
        }

        if (Array.isArray(requestedTenantId)) {
            throw new ForbiddenException('Invalid x-tenant-id header');
        }

        if (requestedTenantId !== user.tenantId && user.role !== 'SUPER_ADMIN') {
            throw new ForbiddenException(
                'You are not permitted to access resources of this tenant',
            );
        }

        return true;
    }
}
