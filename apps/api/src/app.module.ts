import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import { configuration } from './config/configuration';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { RedisModule } from './modules/redis/redis.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UsersModule } from './modules/users/users.module';
import { ClassesModule } from './modules/classes/classes.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { ParentsModule } from './modules/parents/parents.module';
import { SchoolPolicyModule } from './modules/school-policy/school-policy.module';
import { GradesModule } from './modules/grades/grades.module';
import { StudentMarksModule } from './modules/student-marks/student-marks.module';
import { ReportCardsModule } from './modules/report-cards/report-cards.module';
import { TutorialsModule } from './modules/tutorials/tutorials.module';

@Module({
    imports: [
        // ── Configuration ─────────────────────────────────────────────────────
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            validationSchema: Joi.object({
                NODE_ENV: Joi.string()
                    .valid('development', 'staging', 'production', 'test')
                    .default('development'),
                PORT: Joi.number().default(3001),
                ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
                APP_PUBLIC_URL: Joi.string().uri().default('http://localhost:3000'),

                // Supabase
                SUPABASE_URL: Joi.string().uri().required(),
                SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

                // Redis
                REDIS_HOST: Joi.string().default('localhost'),
                REDIS_PORT: Joi.number().default(6379),
                REDIS_PASSWORD: Joi.string().allow('').default(''),

                // JWT
                JWT_SECRET: Joi.string().min(32).required(),
                JWT_EXPIRES_IN: Joi.string().default('15m'),
                JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
            }),
            validationOptions: { abortEarly: false },
        }),

        // ── Infrastructure ────────────────────────────────────────────────────
        SupabaseModule,     // @Global — available across the entire app
        RedisModule,        // @Global — ioredis client + RedisService

        // ── Feature modules ───────────────────────────────────────────────────
        HealthModule,
        AuthModule,
        TenantModule,
        UsersModule,
        ClassesModule,
        StudentsModule,
        TeachersModule,
        ParentsModule,
        SchoolPolicyModule,
        GradesModule,
        StudentMarksModule,
        ReportCardsModule,
        TutorialsModule,
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer
            .apply(TenantContextMiddleware)
            // Exclude health checks and auth routes — everything else requires a tenant slug
            .exclude(
                { path: 'api/v1/health', method: RequestMethod.ALL },
                { path: 'api/v1/health/(.*)', method: RequestMethod.ALL },
                { path: 'api/v1/auth/(.*)', method: RequestMethod.ALL },
                { path: 'api/docs', method: RequestMethod.ALL },
                { path: 'api/docs/(.*)', method: RequestMethod.ALL },
            )
            .forRoutes('*');
    }
}
