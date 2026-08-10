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
import { JwtService } from '@nestjs/jwt';
import { UserRole, TenantStatus } from '@edu-lanka/shared-types';

describe('Authentication (e2e)', () => {
    let app: NestFastifyApplication;
    let jwtService: JwtService;
    let mockSupabase: any;
    let mockRedis: any;
    let mockBuilder: any;
    let validAdminToken: string;
    let validStudentToken: string;

    beforeAll(async () => {
        // Prepare Mock Supabase Builder to return expected responses
        mockBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve({ data: {}, error: null })),
        };
        mockBuilder.from = jest.fn().mockReturnValue(mockBuilder);

        mockSupabase = {
            adminClient: {
                auth: {
                    admin: {
                        createUser: jest.fn(),
                        updateUserById: jest.fn(),
                    },
                    signInWithPassword: jest.fn(),
                    resetPasswordForEmail: jest.fn(),
                },
                ...mockBuilder,
            },
            getTenantClient: jest.fn().mockReturnValue({
                auth: {
                    signUp: jest.fn(),
                    signInWithPassword: jest.fn(),
                    resetPasswordForEmail: jest.fn(),
                    updateUser: jest.fn(),
                },
                ...mockBuilder,
            })
        };

        mockRedis = {
            storeRefreshToken: jest.fn().mockResolvedValue(undefined),
            isRefreshTokenValid: jest.fn().mockResolvedValue(true),
            revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
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

        validAdminToken = jwtService.sign({
            sub: 'admin-123',
            tenantId: 'tenant-123',
            role: UserRole.SCHOOL_ADMIN,
            email: 'admin@test.com'
        });

        validStudentToken = jwtService.sign({
            sub: 'student-123',
            tenantId: 'tenant-123',
            role: UserRole.STUDENT,
            email: 'student@test.com'
        });
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/v1/auth/login', () => {
        it('should login successfully and return token pair', async () => {
            mockSupabase.adminClient.auth.signInWithPassword.mockResolvedValueOnce({
                data: { user: { id: 'user-uuid' } },
                error: null
            });
            // mock tenant slug lookup (adminClient)
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({
                data: { slug: 'tenant-auth', status: TenantStatus.ACTIVE }, error: null
            }));
            // mock the db lookup for user
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({
                data: { id: 'db-user-id', role: UserRole.STUDENT, is_active: true }, error: null
            }));

            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: 'test@host.com', password: 'password123', tenantId: 'tenant-auth' })
                .expect(200);

            expect(res.body.data).toBeDefined();
            expect(res.body.data.access_token).toBeDefined();
            expect(res.body.data.refresh_token).toBeDefined();
        });

        it('should reject invalid credentials', async () => {
            mockSupabase.adminClient.auth.signInWithPassword.mockResolvedValueOnce({
                data: null,
                error: { message: 'Invalid credentials' }
            });

            await request(app.getHttpServer())
                .post('/api/v1/auth/login')
                .send({ email: 'bad@host.com', password: 'password123', tenantId: 'tenant-auth' })
                .expect(401);
        });
    });

    describe('POST /api/v1/auth/signup', () => {
        it('should reject signup without Bearer token', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/signup')
                .send({ email: 'new@host.com', password: 'password123', fullName: 'New User', role: UserRole.TEACHER, tenantId: 'tenant-123' })
                .expect(401);
        });

        it('should reject signup if caller is not an admin', async () => {
            await request(app.getHttpServer())
                .post('/api/v1/auth/signup')
                .set('Authorization', `Bearer ${validStudentToken}`)
                .send({ email: 'new@host.com', password: 'password123', fullName: 'New User', role: UserRole.TEACHER, tenantId: 'tenant-123' })
                .expect(403);
        });

        it('should allow admin to create user', async () => {
            mockSupabase.adminClient.auth.admin.createUser.mockResolvedValueOnce({
                data: { user: { id: 'new-uuid' } },
                error: null
            });
            // mock tenant lookup
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { slug: 'tenant-123', status: TenantStatus.ACTIVE }, error: null }));
            // mock db insert
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'db-id' }, error: null }));

            const res = await request(app.getHttpServer())
                .post('/api/v1/auth/signup')
                .set('Authorization', `Bearer ${validAdminToken}`)
                .send({ email: 'new@host.com', password: 'password123', fullName: 'New User', role: UserRole.TEACHER, tenantId: 'tenant-123' })
                .expect(201);

            expect(res.body.accessToken).toBeDefined();
        });
    });

    describe('POST /api/v1/auth/forgot-password', () => {
        it('should trigger reset email successfully', async () => {
            mockSupabase.adminClient.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });

            await request(app.getHttpServer())
                .post('/api/v1/auth/forgot-password')
                .send({ email: 'test@host.com', tenantId: 'tenant-auth' })
                .expect(200);
        });
    });

    describe('POST /api/v1/auth/reset-password', () => {
        it('should reset password with valid token', async () => {
            mockSupabaseClient.auth.setSession.mockResolvedValueOnce({ error: null });
            mockSupabaseClient.auth.updateUser.mockResolvedValueOnce({ error: null });

            await request(app.getHttpServer())
                .post('/api/v1/auth/reset-password')
                .send({ accessToken: 'valid-token', newPassword: 'new-password123' })
                .expect(200);
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        it('should issue new tokens if refresh token is valid', async () => {
            const refreshToken = jwtService.sign({ jti: 'rt-1', sub: 'user-uuid' });

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
            const refreshToken = jwtService.sign({ jti: 'rt-2', sub: 'user-uuid' });

            await request(app.getHttpServer())
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(401);
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        it('should revoke token and return 204', async () => {
            const refreshToken = jwtService.sign({ jti: 'rt-logout', sub: 'user-uuid' });

            await request(app.getHttpServer())
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${validStudentToken}`)
                .send({ refreshToken })
                .expect(204);

            expect(mockRedis.revokeRefreshToken).toHaveBeenCalledWith('rt-logout');
        });
    });
});
