import type { JwtPayload } from '@edu-lanka/shared-types';
import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { UserRole } from '@edu-lanka/shared-types';

/**
 * RolesGuard — enforces role-based access control.
 *
 * Reads the @Roles(...) metadata set on the route handler.
 * If no roles are declared the route is accessible to any authenticated user.
 * Must run AFTER JwtAuthGuard so request.user is already populated.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
 *   @Get('admin-only')
 *   adminOnly() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // No @Roles() decoration → route is open to any authenticated user
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const user = request.user as JwtPayload | undefined;

        if (!user) {
            throw new ForbiddenException('No authenticated user found');
        }

        if (!requiredRoles.includes(user.role as UserRole)) {
            throw new ForbiddenException(
                `Role '${user.role}' is not authorised for this resource. Required: [${requiredRoles.join(', ')}]`,
            );
        }

        return true;
    }
}
