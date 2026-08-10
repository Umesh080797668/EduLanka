import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { VersioningType, ValidationPipe, ExecutionContext } from '@nestjs/common';
import request from 'supertest';

const mockBuilderBase = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'tenant-1', slug: 'tenant-1', status: 'ACTIVE' }, error: null }),
};
(mockBuilderBase as any).from = jest.fn().mockReturnValue(mockBuilderBase);

// Mock Supabase JS globally
const mockSupabaseClient = {
    auth: {
        admin: {
            createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'auth-user-id' } }, error: null })
        }
    },
    ...mockBuilderBase
};
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => mockSupabaseClient)
}));

import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/modules/supabase/supabase.service';
import { RedisService } from './../src/modules/redis/redis.service';
import { UserRole, TenantStatus } from '@edu-lanka/shared-types';
import { JwtAuthGuard } from './../src/common/guards/jwt-auth.guard';
import { Catch, ArgumentsHost, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch()
class ErrorLoggerFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        console.error('------- GLOBAL ERROR -------', exception);
        const res = host.switchToHttp().getResponse<any>();
        if (res.status) {
            const status = exception instanceof HttpException ? exception.getStatus() : 500;
            res.status(status).send(
                exception instanceof HttpException ? exception.getResponse() : { error: exception.message }
            );
        } else if (res.statusCode) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: exception.message }));
        }
    }
}

describe('CRUD and RBAC (e2e)', () => {
    let app: NestFastifyApplication;
    let mockSupabase: any;
    let mockRedis: any;
    let mockBuilder: any;

    beforeAll(async () => {
        mockBuilder = {
            select: jest.fn().mockImplementation(() => mockBuilder),
            eq: jest.fn().mockImplementation(() => mockBuilder),
            insert: jest.fn().mockImplementation(() => mockBuilder),
            update: jest.fn().mockImplementation(() => mockBuilder),
            limit: jest.fn().mockImplementation(() => mockBuilder),
            single: jest.fn().mockImplementation(() => mockBuilder),
            maybeSingle: jest.fn().mockImplementation(() => mockBuilder),
            then: jest.fn((resolve) => resolve({ data: {}, error: null })),
        };
        mockBuilder.from = jest.fn().mockReturnValue(mockBuilder);

        mockSupabase = {
            adminClient: {
                auth: {
                    admin: {
                        createUser: jest.fn(),
                        deleteUser: jest.fn(),
                    },
                },
                ...mockBuilder,
            },
            getTenantClient: jest.fn().mockReturnValue({
                auth: {
                    admin: {
                        createUser: jest.fn(),
                        deleteUser: jest.fn(),
                    }
                },
                ...mockBuilder,
            })
        };

        mockRedis = {
            get: jest.fn().mockResolvedValue(JSON.stringify({ id: 'tenant-1', slug: 'tenant-1', status: TenantStatus.ACTIVE })),
            set: jest.fn().mockResolvedValue(undefined),
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
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => {
                    const req = context.switchToHttp().getRequest();
                    const authHeader = req.headers.authorization || '';
                    if (authHeader.includes('admin-token')) {
                        req.user = { sub: 'admin-123', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' };
                        return true;
                    }
                    if (authHeader.includes('teacher-token')) {
                        req.user = { sub: 'teacher-123', role: UserRole.TEACHER, tenantId: 'tenant-1' };
                        return true;
                    }
                    if (authHeader.includes('diff-tenant-admin')) {
                        req.user = { sub: 'admin-999', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-999' };
                        return true;
                    }
                    return false;
                }
            })
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        app.useGlobalFilters(new ErrorLoggerFilter());
        app.setGlobalPrefix('api');
        app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/v1/students (Create Student)', () => {
        it('should allow Admin to create a student', async () => {
            mockSupabase.adminClient.auth.admin.createUser.mockResolvedValueOnce({
                data: { user: { id: 'new-auth-id' } }, error: null
            });
            // DB insert succeeds
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'student-id' }, error: null }));

            const res = await request(app.getHttpServer())
                .post('/api/v1/students')
                .set('Authorization', `Bearer admin-token`)
                .set('x-tenant-id', 'tenant-1') // Matching header ensures TenantContextMiddleware is happy
                .send({
                    email: 'student@example.com',
                    temporaryPassword: 'Password123!',
                    fullName: 'Test Student',
                }); expect(res.status).toBe(201);
        });

        it('should reject creation if Student Cap (250) is exceeded', async () => {
            mockSupabase.adminClient.auth.admin.createUser.mockResolvedValueOnce({
                data: { user: { id: 'new-auth-id' } }, error: null
            });

            // Mock TenantContextMiddleware lookup
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'tenant-1', slug: 'tenant-1', status: 'ACTIVE' }, error: null }));
            // Mock TenantService lookup
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'tenant-1', slug: 'tenant-1', status: 'ACTIVE' }, error: null }));

            // Mock Supabase throwing the exact RLS/Trigger constraint error for cap
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({
                data: null, error: { message: '250 student cap exceeded for free tier' }
            }));

            // Mock auth rollback
            mockSupabase.adminClient.auth.admin.deleteUser.mockResolvedValueOnce({ data: {}, error: null });

            const res = await request(app.getHttpServer())
                .post('/api/v1/students')
                .set('Authorization', `Bearer admin-token`)
                .set('x-tenant-id', 'tenant-1')
                .send({
                    email: 'student2@example.com',
                    temporaryPassword: 'Password123!',
                    fullName: 'Test Student 2',
                });
            if (res.status === 500) console.log("CAP 500:", res.body);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Forbidden');
        });

        it('should reject creation from Teacher (Cross-role block)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/students')
                .set('Authorization', `Bearer teacher-token`)
                .set('x-tenant-id', 'tenant-1')
                .send({
                    email: 'student@example.com',
                    temporaryPassword: 'Password123!',
                    fullName: 'Test',
                    admissionNo: 'ADM-001'
                });

            expect(res.status).toBe(403);
        });

        it('should reject creation in a different tenant (Cross-tenant block)', async () => {
            const res = await request(app.getHttpServer())
                .post('/api/v1/students')
                .set('Authorization', `Bearer diff-tenant-admin`) // This user is scoped to tenant-999
                .set('x-tenant-id', 'tenant-1') // Tries to insert into tenant-1
                .send({
                    email: 'student@example.com',
                    temporaryPassword: 'Password123!',
                    fullName: 'Test Student',
                    admissionNo: 'ADM-001'
                });

            // TenantGuard checks if req.user.tenantId matches req.headers['x-tenant-id']
            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/v1/teachers (Create Teacher)', () => {
        it('should allow Admin to create a teacher', async () => {
            mockSupabase.adminClient.auth.admin.createUser.mockResolvedValueOnce({
                data: { user: { id: 'new-auth-id' } }, error: null
            });
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'teacher-id' }, error: null }));

            const res = await request(app.getHttpServer())
                .post('/api/v1/teachers')
                .set('Authorization', `Bearer admin-token`)
                .set('x-tenant-id', 'tenant-1')
                .send({
                    email: 'teacher@example.com',
                    temporaryPassword: 'Password123!',
                    fullName: 'Test Teacher'
                });

            expect(res.status).toBe(201);
        });
    });

    describe('POST /api/v1/parents/:id/link-student (Link Parent)', () => {
        it('should allow Admin to link parent and student', async () => {
            // lookup parent
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '223e4567-e89b-12d3-a456-426614174000', role: UserRole.PARENT }, error: null }));
            // lookup student
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: '123e4567-e89b-12d3-a456-426614174000', role: UserRole.STUDENT }, error: null }));
            // insert edge
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: {}, error: null }));

            const res = await request(app.getHttpServer())
                .post('/api/v1/parents/223e4567-e89b-12d3-a456-426614174000/link-student')
                .set('Authorization', `Bearer admin-token`)
                .set('x-tenant-id', 'tenant-1')
                .send({ studentId: '123e4567-e89b-12d3-a456-426614174000' });

            expect(res.status).toBe(201);
        });
    });

    describe('PATCH /api/v1/school-policy (Update Policy)', () => {
        it('should allow Admin to update policy', async () => {
            // Update successful
            mockBuilder.then.mockImplementationOnce((resolve: any) => resolve({ data: { id: 'policy-123' }, error: null }));

            const res = await request(app.getHttpServer())
                .patch('/api/v1/school-policy')
                .set('Authorization', `Bearer admin-token`)
                .set('x-tenant-id', 'tenant-1')
                .send({
                    termsAndConditions: 'Updated Terms',
                    maxStudentsPerClass: 30
                });

            expect(res.status).toBe(200);
        });

        it('should block Teacher from updating policy', async () => {
            const res = await request(app.getHttpServer())
                .patch('/api/v1/school-policy')
                .set('Authorization', `Bearer teacher-token`)
                .set('x-tenant-id', 'tenant-1')
                .send({
                    termsAndConditions: 'Cannot update'
                });

            expect(res.status).toBe(403);
        });
    });
});
