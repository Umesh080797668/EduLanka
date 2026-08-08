
import { UserRole } from '@edu-lanka/shared-types';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';

// ── Helper: build a mock ExecutionContext ─────────────────────────────────────

function makeContext(userRole: UserRole | null): ExecutionContext {
    return {
        getHandler: jest.fn().mockReturnValue({}),
        getClass: jest.fn().mockReturnValue({}),
        switchToHttp: () => ({
            getRequest: () => ({
                user: userRole !== null ? { role: userRole } : undefined,
            }),
        }),
    } as unknown as ExecutionContext;
}

// ── Helper: build a Reflector that returns specific roles ────────────────────

function makeReflector(roles: UserRole[] | undefined): Reflector {
    return {
        getAllAndOverride: jest.fn().mockReturnValue(roles),
    } as unknown as Reflector;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
    // ── No @Roles() decoration (open to authenticated users) ─────────────────

    it('allows access when no roles metadata is set', () => {
        const guard = new RolesGuard(makeReflector(undefined));
        expect(guard.canActivate(makeContext(UserRole.STUDENT))).toBe(true);
    });

    it('allows access when roles array is empty', () => {
        const guard = new RolesGuard(makeReflector([]));
        expect(guard.canActivate(makeContext(UserRole.STUDENT))).toBe(true);
    });

    // ── Matching role ─────────────────────────────────────────────────────────

    it('allows SCHOOL_ADMIN when route requires SCHOOL_ADMIN', () => {
        const guard = new RolesGuard(makeReflector([UserRole.SCHOOL_ADMIN]));
        expect(guard.canActivate(makeContext(UserRole.SCHOOL_ADMIN))).toBe(true);
    });

    it('allows SUPER_ADMIN when route requires SCHOOL_ADMIN or SUPER_ADMIN', () => {
        const guard = new RolesGuard(makeReflector([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN]));
        expect(guard.canActivate(makeContext(UserRole.SUPER_ADMIN))).toBe(true);
    });

    it('allows TEACHER when route requires TEACHER', () => {
        const guard = new RolesGuard(makeReflector([UserRole.TEACHER]));
        expect(guard.canActivate(makeContext(UserRole.TEACHER))).toBe(true);
    });

    // ── Non-matching role → ForbiddenException ────────────────────────────────

    it('denies STUDENT access to TEACHER-only route', () => {
        const guard = new RolesGuard(makeReflector([UserRole.TEACHER]));
        expect(() => guard.canActivate(makeContext(UserRole.STUDENT)))
            .toThrow(ForbiddenException);
    });

    it('denies PARENT access to SCHOOL_ADMIN route', () => {
        const guard = new RolesGuard(makeReflector([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN]));
        expect(() => guard.canActivate(makeContext(UserRole.PARENT)))
            .toThrow(ForbiddenException);
    });

    it('denies TEACHER access to SUPER_ADMIN-only route', () => {
        const guard = new RolesGuard(makeReflector([UserRole.SUPER_ADMIN]));
        expect(() => guard.canActivate(makeContext(UserRole.TEACHER)))
            .toThrow(ForbiddenException);
    });

    it('denies ZONAL_OFFICER access to SCHOOL_ADMIN route', () => {
        const guard = new RolesGuard(makeReflector([UserRole.SCHOOL_ADMIN]));
        expect(() => guard.canActivate(makeContext(UserRole.ZONAL_OFFICER)))
            .toThrow(ForbiddenException);
    });

    it('denies MOE_OFFICER access to TEACHER-only route', () => {
        const guard = new RolesGuard(makeReflector([UserRole.TEACHER]));
        expect(() => guard.canActivate(makeContext(UserRole.MOE_OFFICER)))
            .toThrow(ForbiddenException);
    });

    // ── Missing user on request ───────────────────────────────────────────────

    it('throws ForbiddenException when no user is on the request', () => {
        const guard = new RolesGuard(makeReflector([UserRole.SCHOOL_ADMIN]));
        expect(() => guard.canActivate(makeContext(null)))
            .toThrow(ForbiddenException);
    });

    // ── ROLES_KEY exported correctly ──────────────────────────────────────────

    it('uses the correct metadata key', () => {
        expect(ROLES_KEY).toBe('roles');
    });
});
