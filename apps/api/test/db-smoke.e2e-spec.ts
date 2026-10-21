/**
 * EduLanka — Real Database Smoke Test (CI DB-Backed Suite)
 *
 * Exercises the critical database queries, generated columns, foreign-key embeds,
 * views, and RPCs against a real PostgreSQL / Supabase database instance.
 *
 * Verifies the 5 historical real-database failure sites:
 * 1. Attendance Roster (GET /api/v1/attendance/roster?classId=...) -> classes.name, admission_no, no deleted_at filter
 * 2. Attendance Submission (POST /api/v1/attendance) -> student enrollment validation query
 * 3. Nightly Billing Generation (POST /api/v1/billing/snapshots/generate) -> v_active_students_per_tenant view & RPC
 * 4. Blogs List & Detail (GET /api/v1/blogs) -> classes(id, name, grade) PostgREST embed
 * 5. Homework List & Detail (GET /api/v1/homework) -> classes(id, name, grade) PostgREST embed
 * 6. Global Tutorial Stats (GET /api/v1/system-admin/tutorials/stats) -> get_global_tutorial_stats() RPC
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { VersioningType, ValidationPipe, ExecutionContext } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { AppModule } from '../src/app.module';
import { RedisService } from '../src/modules/redis/redis.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { UserRole } from '@edu-lanka/shared-types';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TENANT_ID = '45f9722b-eda0-453f-88d2-2c9ad06ec169'; // Royal College
const CLASS_ID = '5efafc07-194a-4811-829f-af8e126ddb08';   // Grade 10-A
const STUDENT_ID = 'bcb2198f-8cb7-41dd-b3ad-691799c524de'; // Kasun Fernando
const TEACHER_USER_ID = 'dcab3ce4-fdc0-44c1-8e4d-8d363d411380';
const TEACHER_ENTITY_ID = 'bea8bd19-7f07-40e9-b635-29cd87af8a4b';

describe('Real Database Smoke Test (CI Suite)', () => {
    let app: NestFastifyApplication;
    let isDbReachable = false;
    let admin: any;

    beforeAll(async () => {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            if (process.env.CI) {
                throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in CI environment!');
            }
            return;
        }

        admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Fast probe to verify PostgreSQL availability
        try {
            const probe = admin.from('tenants').select('id').limit(1);
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
            await Promise.race([probe, timeout]);
            isDbReachable = true;
        } catch {
            isDbReachable = false;
            if (process.env.CI) {
                throw new Error(`Database at ${SUPABASE_URL} is unreachable in CI environment!`);
            }
            return;
        }

        // Ensure prerequisite seed entities exist for foreign-key joins
        await admin.from('classes').upsert({
            id: CLASS_ID,
            tenant_id: TENANT_ID,
            grade: 10,
            section: 'A',
            year: 2026,
        }, { onConflict: 'id' });

        await admin.from('homework').upsert({
            id: 'h0000000-0000-0000-0000-000000000001',
            tenant_id: TENANT_ID,
            class_id: CLASS_ID,
            teacher_id: TEACHER_ENTITY_ID,
            title: 'Algebra Polynomials Practice',
            description: 'Complete questions 1 to 15 from Chapter 4',
            due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
            status: 'PUBLISHED',
        }, { onConflict: 'id' });

        await admin.from('blogs').upsert({
            id: 'b0000000-0000-0000-0000-000000000001',
            tenant_id: TENANT_ID,
            class_id: CLASS_ID,
            author_id: TEACHER_USER_ID,
            title: 'Term 3 Mathematics Introduction',
            content: 'Welcome back students. Review polynomials syllabus.',
            status: 'PUBLISHED',
        }, { onConflict: 'id' });

        const mockRedis = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
            storeRefreshToken: jest.fn().mockResolvedValue(undefined),
            isRefreshTokenValid: jest.fn().mockResolvedValue(true),
            revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
            getClient: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue(null),
                set: jest.fn().mockResolvedValue('OK'),
                del: jest.fn().mockResolvedValue(1),
            }),
        };

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(RedisService)
            .useValue(mockRedis)
            .overrideProvider('REDIS_CLIENT')
            .useValue(mockRedis.getClient())
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => {
                    const req = context.switchToHttp().getRequest();
                    const authHeader = req.headers.authorization || '';
                    if (authHeader.includes('super-admin-token')) {
                        req.user = {
                            sub: '980f2893-68e0-4362-9890-fa2626826fc7',
                            role: UserRole.SUPER_ADMIN,
                            tenantId: '91c85e7c-7907-4915-ae70-4d5b7f3a843c',
                        };
                        return true;
                    }
                    if (authHeader.includes('teacher-token')) {
                        req.user = {
                            sub: TEACHER_USER_ID,
                            role: UserRole.TEACHER,
                            tenantId: TENANT_ID,
                        };
                        return true;
                    }
                    if (authHeader.includes('school-admin-token')) {
                        req.user = {
                            sub: 'ec390279-300d-4b82-b4a3-47337681ae2d',
                            role: UserRole.SCHOOL_ADMIN,
                            tenantId: TENANT_ID,
                        };
                        return true;
                    }
                    return false;
                },
            })
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        app.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: '1',
            prefix: 'api/v',
        });
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    }, 30_000);

    afterAll(async () => {
        if (app) {
            await app.close();
        }
        if (admin && isDbReachable) {
            await admin.from('attendance_records').delete().eq('class_id', CLASS_ID).eq('date', '2026-10-21');
        }
    });

    it('1. hits attendance roster route against real DB without missing columns (classes.name, admission_no)', async () => {
        if (!isDbReachable) return;

        const res = await request(app.getHttpServer())
            .get(`/api/v1/attendance/roster?classId=${CLASS_ID}`)
            .set('Authorization', 'Bearer teacher-token')
            .set('x-tenant-id', TENANT_ID);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            const student = res.body[0];
            expect(student).toHaveProperty('admission_no');
            expect(student).not.toHaveProperty('deleted_at');
        }
    });

    it('2. hits attendance record submission against real DB without student enrollment query failure', async () => {
        if (!isDbReachable) return;

        const res = await request(app.getHttpServer())
            .post('/api/v1/attendance')
            .set('Authorization', 'Bearer teacher-token')
            .set('x-tenant-id', TENANT_ID)
            .send({
                date: '2026-10-21',
                classId: CLASS_ID,
                records: [
                    {
                        studentId: STUDENT_ID,
                        status: 'PRESENT',
                    },
                ],
            });

        expect([200, 201]).toContain(res.status);
    });

    it('3. hits nightly billing snapshot generation against real DB using v_active_students_per_tenant', async () => {
        if (!isDbReachable) return;

        const res = await request(app.getHttpServer())
            .post('/api/v1/billing/snapshots/generate')
            .set('Authorization', 'Bearer super-admin-token')
            .send({ billingMonth: '2026-10' });

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('4. hits blogs list route against real DB with classes(id, name, grade) embed', async () => {
        if (!isDbReachable) return;

        const res = await request(app.getHttpServer())
            .get('/api/v1/blogs')
            .set('Authorization', 'Bearer teacher-token')
            .set('x-tenant-id', TENANT_ID);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            const blog = res.body[0];
            if (blog.classes) {
                expect(blog.classes).toHaveProperty('name');
                expect(blog.classes).toHaveProperty('grade');
            }
        }
    });

    it('5. hits homework list route against real DB with classes(id, name, grade) embed', async () => {
        if (!isDbReachable) return;

        const res = await request(app.getHttpServer())
            .get('/api/v1/homework')
            .set('Authorization', 'Bearer teacher-token')
            .set('x-tenant-id', TENANT_ID);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            const hw = res.body[0];
            if (hw.classes) {
                expect(hw.classes).toHaveProperty('name');
                expect(hw.classes).toHaveProperty('grade');
            }
        }
    });

    it('6. hits global tutorial stats route against real DB executing get_global_tutorial_stats RPC', async () => {
        if (!isDbReachable) return;

        const res = await request(app.getHttpServer())
            .get('/api/v1/system-admin/tutorials/stats')
            .set('Authorization', 'Bearer super-admin-token');

        expect(res.status).toBe(200);
    });
});
