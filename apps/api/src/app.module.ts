import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

import { configuration } from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TenantModule } from './modules/tenant/tenant.module';

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

        // ── Feature modules ───────────────────────────────────────────────────
        HealthModule,
        AuthModule,
        TenantModule,
    ],
})
export class AppModule { }
