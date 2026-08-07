import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { RedisService } from '../../redis/redis.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthService } from '../auth.service';

// ── Mock factory helpers ──────────────────────────────────────────────────────

const makeJwtService = (overrides?: Partial<JwtService>) =>
    ({
        signAsync: jest.fn().mockResolvedValue('signed-token'),
        verifyAsync: jest.fn().mockResolvedValue({
            sub: 'user-uuid',
            tenantId: 'tenant-uuid',
            role: UserRole.TEACHER,
            email: 'teacher@school.lk',
            jti: 'refresh-jti-abc',
        } satisfies JwtPayload),
        ...overrides,
    }) as unknown as JwtService;

const makeRedis = (overrides?: {
    storeRefreshToken?: jest.Mock;
    isRefreshTokenValid?: jest.Mock;
    revokeRefreshToken?: jest.Mock;
}): RedisService =>
    ({
        storeRefreshToken: jest.fn().mockResolvedValue(undefined),
        isRefreshTokenValid: jest.fn().mockResolvedValue(true),
        revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    }) as unknown as RedisService;

const makeSupabase = (opts?: {
    signInError?: boolean;
    tenantStatus?: string;
    noTenant?: boolean;
    noUser?: boolean;
    userInactive?: boolean;
    createUserError?: boolean;
    insertError?: boolean;
    resetError?: boolean;
}): SupabaseService => {
    const o = opts ?? {};
    const authUser = { id: 'supabase-auth-uid' };
    const tenantRow = { slug: 'school-a', status: o.tenantStatus ?? 'ACTIVE' };
    const userRow = { id: 'user-uuid', role: UserRole.TEACHER, is_active: !o.userInactive };

    // Minimal chain builder for Supabase query builder
    const makeChain = (data: unknown, error: unknown = null) => ({
        select: () => makeChain(data, error),
        eq: () => makeChain(data, error),
        maybeSingle: () => Promise.resolve({ data, error }),
        insert: () => ({
            select: () => ({
                single: () =>
                    Promise.resolve(
                        o.insertError
                            ? { data: null, error: { message: 'insert fail' } }
                            : { data: { id: 'new-user-uuid' }, error: null },
                    ),
            }),
        }),
    });

    return {
        adminClient: {
            auth: {
                signInWithPassword: jest.fn().mockResolvedValue(
                    o.signInError
                        ? { data: { user: null }, error: { message: 'bad creds' } }
                        : { data: { user: authUser }, error: null },
                ),
                resetPasswordForEmail: jest.fn().mockResolvedValue(
                    o.resetError ? { error: { message: 'reset fail' } } : { error: null },
                ),
                admin: {
                    createUser: jest.fn().mockResolvedValue(
                        o.createUserError
                            ? { data: { user: null }, error: { message: 'creation failed' } }
                            : { data: { user: authUser }, error: null },
                    ),
                    deleteUser: jest.fn().mockResolvedValue({ error: null }),
                },
            },
            from: () => (o.noTenant ? makeChain(null) : makeChain(tenantRow)),
        },
        getTenantClient: () => ({
            from: () => (o.noUser ? makeChain(null) : makeChain(userRow)),
        }),
    } as unknown as SupabaseService;
};

// ── ConfigService mock ────────────────────────────────────────────────────────

const configValues: Record<string, unknown> = {
    'jwt.expiresIn': '15m',
    'jwt.refreshExpiresIn': '7d',
    'supabase.url': 'https://fake.supabase.co',
    'supabase.serviceRoleKey': 'fake-service-role-key',
    'app.allowedOrigins': ['http://localhost:3000'],
};

const makeConfigService = (): ConfigService =>
    ({ get: (key: string) => configValues[key] }) as unknown as ConfigService;

// ── Module builder ────────────────────────────────────────────────────────────

async function buildModule(supabase: SupabaseService, jwtSvc?: JwtService, redisSvc?: RedisService): Promise<{
    service: AuthService;
    redis: RedisService;
    jwt: JwtService;
}> {
    const jwt = jwtSvc ?? makeJwtService();
    const redis = redisSvc ?? makeRedis();

    const module: TestingModule = await Test.createTestingModule({
        providers: [
            AuthService,
            { provide: JwtService, useValue: jwt },
            { provide: SupabaseService, useValue: supabase },
            { provide: RedisService, useValue: redis },
            { provide: ConfigService, useValue: makeConfigService() },
        ],
    }).compile();

    return { service: module.get(AuthService), redis, jwt };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
    // ── login() ───────────────────────────────────────────────────────────────

    describe('login()', () => {
        it('returns a token pair on valid credentials', async () => {
            const { service } = await buildModule(makeSupabase());
            const result = await service.login('t@school.lk', 'pass123456', 'tenant-uuid');
            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(result).toHaveProperty('expiresIn');
        });

        it('stores refresh token in Redis on login', async () => {
            const { service, redis } = await buildModule(makeSupabase());
            await service.login('t@school.lk', 'pass123456', 'tenant-uuid');
            expect(redis.storeRefreshToken).toHaveBeenCalledTimes(1);
        });

        it('throws UnauthorizedException on bad credentials', async () => {
            const { service } = await buildModule(makeSupabase({ signInError: true }));
            await expect(service.login('t@school.lk', 'wrong', 'tenant-uuid'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('throws NotFoundException when tenant does not exist', async () => {
            const { service } = await buildModule(makeSupabase({ noTenant: true }));
            await expect(service.login('t@school.lk', 'pass123456', 'tenant-uuid'))
                .rejects.toThrow(NotFoundException);
        });

        it('throws UnauthorizedException when tenant is SUSPENDED', async () => {
            const { service } = await buildModule(makeSupabase({ tenantStatus: 'SUSPENDED' }));
            await expect(service.login('t@school.lk', 'pass123456', 'tenant-uuid'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when user is not in the tenant', async () => {
            const { service } = await buildModule(makeSupabase({ noUser: true }));
            await expect(service.login('t@school.lk', 'pass123456', 'tenant-uuid'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when user account is inactive', async () => {
            const { service } = await buildModule(makeSupabase({ userInactive: true }));
            await expect(service.login('t@school.lk', 'pass123456', 'tenant-uuid'))
                .rejects.toThrow(UnauthorizedException);
        });

        it('throws BadRequestException when required fields are missing', async () => {
            const { service } = await buildModule(makeSupabase());
            await expect(service.login('', 'pass123456', 'tenant-uuid'))
                .rejects.toThrow(BadRequestException);
        });
    });

    // ── signup() ──────────────────────────────────────────────────────────────

    describe('signup()', () => {
        const adminCaller: JwtPayload = {
            sub: 'admin-uuid',
            tenantId: 'tenant-uuid',
            role: UserRole.SCHOOL_ADMIN,
            email: 'admin@school.lk',
        };
        const dto = {
            email: 'new@school.lk',
            password: 'SecurePass123!',
            fullName: 'New User',
            tenantId: 'tenant-uuid',
            role: UserRole.TEACHER,
        };

        it('returns a token pair on successful signup', async () => {
            const { service } = await buildModule(makeSupabase());
            const result = await service.signup(dto, adminCaller);
            expect(result).toHaveProperty('accessToken');
        });

        it('throws ForbiddenException when SCHOOL_ADMIN creates user in another tenant', async () => {
            const { service } = await buildModule(makeSupabase());
            await expect(service.signup({ ...dto, tenantId: 'other-tenant' }, adminCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('allows SUPER_ADMIN to create user in any tenant', async () => {
            const superCaller: JwtPayload = { ...adminCaller, role: UserRole.SUPER_ADMIN, tenantId: '' };
            const { service } = await buildModule(makeSupabase());
            const result = await service.signup({ ...dto, tenantId: 'tenant-uuid' }, superCaller);
            expect(result).toHaveProperty('accessToken');
        });

        it('throws InternalServerErrorException on Supabase createUser failure', async () => {
            const { service } = await buildModule(makeSupabase({ createUserError: true }));
            await expect(service.signup(dto, adminCaller))
                .rejects.toThrow(InternalServerErrorException);
        });

        it('throws InternalServerErrorException on tenant user insert failure (and rolls back)', async () => {
            const { service } = await buildModule(makeSupabase({ insertError: true }));
            await expect(service.signup(dto, adminCaller))
                .rejects.toThrow(InternalServerErrorException);
        });
    });

    // ── forgotPassword() ──────────────────────────────────────────────────────

    describe('forgotPassword()', () => {
        it('always returns a success message (prevents user enumeration)', async () => {
            const { service } = await buildModule(makeSupabase());
            const result = await service.forgotPassword('anyone@school.lk', 'tenant-uuid');
            expect(result.message).toContain('password reset link');
        });

        it('still returns success even when Supabase reports an error', async () => {
            const { service } = await buildModule(makeSupabase({ resetError: true }));
            const result = await service.forgotPassword('unknown@school.lk', 'tenant-uuid');
            expect(result.message).toBeDefined();
        });
    });

    // ── refreshTokens() ───────────────────────────────────────────────────────

    describe('refreshTokens()', () => {
        it('issues a new token pair for a valid refresh token', async () => {
            const { service, redis } = await buildModule(makeSupabase());
            const result = await service.refreshTokens('valid.refresh.token');
            expect(result).toHaveProperty('accessToken');
            expect(redis.revokeRefreshToken).toHaveBeenCalledWith('refresh-jti-abc');
        });

        it('throws UnauthorizedException when refresh token is expired/invalid', async () => {
            const expiredJwt = makeJwtService({
                verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')),
            });
            const { service } = await buildModule(makeSupabase(), expiredJwt);
            await expect(service.refreshTokens('expired.token')).rejects.toThrow(UnauthorizedException);
        });

        it('throws UnauthorizedException when jti has been revoked in Redis', async () => {
            const revokedRedis = makeRedis({ isRefreshTokenValid: jest.fn().mockResolvedValue(false) });
            const { service } = await buildModule(makeSupabase(), undefined, revokedRedis);
            await expect(service.refreshTokens('revoked.token')).rejects.toThrow(UnauthorizedException);
        });

        it('rotates the token — stores a new jti after revoking the old one', async () => {
            const { service, redis } = await buildModule(makeSupabase());
            await service.refreshTokens('valid.refresh.token');
            expect(redis.revokeRefreshToken).toHaveBeenCalledTimes(1);
            expect(redis.storeRefreshToken).toHaveBeenCalledTimes(1);
        });
    });

    // ── logout() ─────────────────────────────────────────────────────────────

    describe('logout()', () => {
        const user: JwtPayload = {
            sub: 'user-uuid',
            tenantId: 'tenant-uuid',
            role: UserRole.TEACHER,
            email: 't@school.lk',
        };

        it('revokes the refresh token jti in Redis', async () => {
            const { service, redis } = await buildModule(makeSupabase());
            await service.logout(user, 'valid.refresh.token');
            expect(redis.revokeRefreshToken).toHaveBeenCalledWith('refresh-jti-abc');
        });

        it('does not throw when no refresh token is provided', async () => {
            const { service } = await buildModule(makeSupabase());
            await expect(service.logout(user, '')).resolves.toBeUndefined();
        });

        it('does not throw when refresh token is already expired', async () => {
            const expiredJwt = makeJwtService({
                verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')),
            });
            const { service } = await buildModule(makeSupabase(), expiredJwt);
            await expect(service.logout(user, 'expired.token')).resolves.toBeUndefined();
        });
    });
});
