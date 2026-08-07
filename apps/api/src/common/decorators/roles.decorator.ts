import { UserRole } from '@edu-lanka/shared-types';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict a route to specific user roles.
 *
 * Must be combined with JwtAuthGuard + RolesGuard (in that order):
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
