import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

import { SuperAdminGuard } from '../super-admin.guard';

describe('SuperAdminGuard (Analytics)', () => {
    let guard: SuperAdminGuard;

    beforeEach(() => {
        guard = new SuperAdminGuard();
    });

    const createMockContext = (user: any): ExecutionContext => {
        return {
            switchToHttp: () => ({
                getRequest: () => ({
                    user,
                }),
            }),
        } as unknown as ExecutionContext;
    };

    it('should throw UnauthorizedException when request.user is missing', () => {
        const context = createMockContext(undefined);
        expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when user is not SUPER_ADMIN', () => {
        const context = createMockContext({
            sub: '123',
            role: UserRole.SCHOOL_ADMIN,
        });
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should allow access when user is SUPER_ADMIN', () => {
        const context = createMockContext({
            sub: '123',
            role: UserRole.SUPER_ADMIN,
        });
        expect(guard.canActivate(context)).toBe(true);
    });
});
