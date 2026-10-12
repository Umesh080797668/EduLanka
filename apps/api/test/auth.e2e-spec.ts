import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { VersioningType, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

// Mock Supabase JS globally for methods that bypass SupabaseService like resetPassword
const mockSupabaseClient = {
    auth: {
        setSession: jest.fn().mockResolvedValue({ error: null }),
        updateUser: jest.fn().mockResolvedValue({ error: null })
    }
};
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabaseClient)
}));

import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';
import { RedisService } from './../src/modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, TenantStatus } from '@edu-lanka/shared-types';

process.env['JWT_SECRET'] =
    process.env['JWT_SECRET'] || 'test-mock-jwt-secret-for-unit-and-e2e-testing-only-32chars';

jest.setTimeout(60000);

describe('Authentication (e2e)', () => {
    let app: NestFastifyApplication;
    let jwtService: JwtService;
    let mockSupabase: any;
    let mockAuth: any;
    let mockRedis: any;
    let mockBuilder: any;
    let validAdminToken: string;
    let validStudentToken: string;
    let testJwtSecret: string;

    const TEST_TENANT_ID = '45f9722b-eda0-453f-88d2-2c9ad06ec169';

    beforeAll(async () => {
        mockAuth = {
            signInWithPassword: jest.fn(),
        };

        const createQueryBuilder = () => {
            const builder: any = {
                select: jest.fn(() => builder),
                eq: jest.fn(() => builder),
                insert: jest.fn(() => builder),
                update: jest.fn(() => builder),
                delete: jest.fn(() => builder),
                single: jest.fn(() => Promise.resolve({ data: { id: TEST_TENANT_ID, slug: 'tenant-123', status: 'ACTIVE', is_active: true, email: 'new@host.com' }, error: null })),
                maybeSingle: jest.fn(() => Promise.resolve({ data: { id: TEST_TENANT_ID, slug: 'tenant-123', status: 'ACTIVE', is_active: true, email: 'new@host.com' }, error: null })),
                then: (resolve: any) => Promise.resolve({ data: { id: TEST_TENANT_ID, slug: 'tenant-123', status: 'ACTIVE', is_active: true, email: 'new@host.com' }, error: null }).then(resolve),
            };
            return builder;
        };

        mockSupabase = {
            createAuthClient: jest.fn().mockReturnValue({ auth: mockAuth }),
            adminClient: {
                auth: {
                    admin: {
                        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } }, error: null }),
                        updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
                        deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
                    },
                    getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } }, error: null }),
                    signInWithPassword: jest.fn(),
                    resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
                },
                channel: jest.fn().mockReturnValue({
                    subscribe: jest.fn().mockReturnThis(),
                    on: jest.fn().mockReturnThis(),
                }),
                from: jest.fn(() => createQueryBuilder()),
            },
            getTenantClient: jest.fn().mockReturnValue({
                auth: {
                    signUp: jest.fn(),
                    signInWithPassword: jest.fn(),
                    resetPasswordForEmail: jest.fn().mockResolvedValue({ data: {}, error: null }),
                    updateUser: jest.fn(),
                },
                from: jest.fn(() => createQueryBuilder()),
            })
        };

        mockRedis = {
            storeRefreshToken: jest.fn().mockResolvedValue(undefined),
            isRefreshTokenValid: jest.fn().mockResolvedValue(true),
            revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
            revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
            isTokenRevoked: jest.fn().mockResolvedValue(false),
            getCachedUserActive: jest.fn().mockResolvedValue(true),
            cacheUserActive: jest.fn().mockResolvedValue(undefined),
            getClient: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(null),
                set: jest.fn().mockResolvedValue('OK'),
                setex: jest.fn().mockResolvedValue('OK'),
            }),
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(SupabaseService)
            .useValue(mockSupabase)
            .overrideProvider(RedisService)
            .useValue(mockRedis)
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, transform: true }),
        );

        app.setGlobalPrefix('api');
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
        });

        await app.init();
        await app.getHttpAdapter().getInstance().ready();

        jwtService = app.get<JwtService>(JwtService);
        const configService = app.get<ConfigService>(ConfigService);
        testJwtSecret = configService.get<string>('jwt.secret') || 'test-mock-jwt-secret-for-unit-and-e2e-testing-only-32chars';

        validAdminToken = jwtService.sign({
            sub: 'admin-123',
            tenantId: TEST_TENANT_ID,
            role: UserRole.SCHOOL_ADMIN,
            email: 'admin@test.com',
            type: 'access',
        }, { secret: testJwtSecret });

        validStudentToken = jwtService.sign({
            sub: 'student-123',
            tenantId: TEST_TENANT_ID,
            role: UserRole.STUDENT,
            email: 'student@test.com',
            type: 'access',
        }, { secret: testJwtSecret });
    }, 60_000);

    afterAll(async () => {
        if (app) await app.close();
    }, 60_000);

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login successfully and return token pair', async () => {
            mockAuth.signInWithPassword.mockResolvedValueOnce({
                data: {
                    user: {
                        id: 'user-uuid',
                        email: 'test@host.com',
                        user_metadata: { tenant_id: TEST_TENANT_ID },
                    },
                },
                error: null,
            });

            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: 'test@host.com', password: 'password123', tenantId: TEST_TENANT_ID })
                .expect(200);

            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
        });

        it('should reject invalid credentials', async () => {
            mockAuth.signInWithPassword.mockResolvedValueOnce({
                data: null,
                error: { message: 'Invalid credentials' }
            });

            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: 'bad@host.com', password: 'password123', tenantId: TEST_TENANT_ID })
                .expect(401);
        });
    });

    describe('POST /api/v1/auth/signup', () => {
        it('should reject signup without Bearer token', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/signup')
                .send({
                    email: 'new@host.com',
                    password: 'password123',
                    fullName: 'New User',
                    role: UserRole.TEACHER,
                    tenantId: TEST_TENANT_ID,
                })
                .expect(401);
        });

        it('should reject signup if caller is not an admin', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/signup')
                .set('Authorization', `Bearer ${validStudentToken}`)
                .send({
                    email: 'new@host.com',
                    password: 'password123',
                    fullName: 'New User',
                    role: UserRole.TEACHER,
                    tenantId: TEST_TENANT_ID,
                })
                .expect(403);
        });

        it('should allow admin to create user', async () => {
            mockSupabase.adminClient.auth.admin.createUser.mockResolvedValueOnce({
                data: { user: { id: 'new-uuid' } },
                error: null
            });

            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/signup')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({
                    email: 'new@host.com',
                    password: 'password123',
                    fullName: 'New User',
                    role: UserRole.TEACHER,
                    tenantId: TEST_TENANT_ID,
                });

            expect(res.status).toBe(201);

            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('new@host.com');
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        it('should trigger reset email successfully', async () => {
            mockSupabase.adminClient.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });

            await request(app.getHttpServer())
                .post('/api/v1/auth/forgot-password')
                .send({ email: 'test@host.com', tenantId: TEST_TENANT_ID })
                .expect(200);
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        it('should reset password with valid token', async () => {
            mockSupabase.adminClient.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-uuid' } }, error: null });
            mockSupabase.adminClient.auth.admin.updateUserById.mockResolvedValueOnce({ data: {}, error: null });

            await request(app.getHttpServer())
                .post('/api/v1/auth/reset-password')
                .send({ accessToken: 'valid-token', newPassword: 'new-password123' })
                .expect(200);
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        it('should issue new tokens if refresh token is valid', async () => {
            const refreshToken = jwtService.sign({
                jti: 'rt-1',
                sub: 'user-uuid',
                role: UserRole.STUDENT,
                tenantId: TEST_TENANT_ID,
                email: 'test@host.com',
                type: 'refresh',
            }, { secret: testJwtSecret });

            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            expect(mockRedis.isRefreshTokenValid).toHaveBeenCalledWith('rt-1');
            expect(mockRedis.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
            expect(res.body.accessToken).toBeDefined();
        });

        it('should reject blacklisted refresh tokens', async () => {
            mockRedis.isRefreshTokenValid.mockResolvedValueOnce(false);
            const refreshToken = jwtService.sign({
                jti: 'rt-2',
                sub: 'user-uuid',
                role: UserRole.STUDENT,
                tenantId: TEST_TENANT_ID,
                email: 'test@host.com',
                type: 'refresh',
            }, { secret: testJwtSecret });

            await request(app.getHttpServer())
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(401);
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        it('should revoke token and return 204', async () => {
            const refreshToken = jwtService.sign({
                jti: 'rt-logout',
                sub: 'user-uuid',
                role: UserRole.STUDENT,
                tenantId: TEST_TENANT_ID,
                email: 'test@host.com',
                type: 'refresh',
            }, { secret: testJwtSecret });

            await request(app.getHttpServer())
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${validStudentToken}`)
                .send({ refreshToken })
                .expect(204);

            expect(mockRedis.revokeRefreshToken).toHaveBeenCalledWith('rt-logout');
        });
    });
});
