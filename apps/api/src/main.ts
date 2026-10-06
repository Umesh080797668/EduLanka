import * as dotenv from 'dotenv';
dotenv.config();

import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import { VersioningType, ValidationPipe, Logger, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import {
    FastifyAdapter,
    type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

type FastifyApp = Omit<NestFastifyApplication, 'enableCors'> & INestApplication;

async function bootstrap(): Promise<void> {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create<FastifyApp>(
        AppModule,
        new FastifyAdapter({ logger: false, trustProxy: 1 as unknown as boolean }), // NestJS Logger handles logging, trustProxy: 1 ensures only direct upstream (nginx) is trusted
    );

    const configService = app.get(ConfigService);
    const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
    const port = configService.get<number>('app.port', 3001);
    const allowedOrigins = configService.get<string[]>('app.allowedOrigins', []);

    // ── Security ──────────────────────────────────────────────────────────────
    await app.register(helmet, {
        contentSecurityPolicy: nodeEnv === 'production',
    });
    await app.register(compression, { encodings: ['gzip', 'deflate', 'br'] });

    app.enableCors({
        origin: nodeEnv === 'development' ? true : allowedOrigins,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
    });

    // ── Versioning ────────────────────────────────────────────────────────────
    // All routes accessed via /api/v1/...
    app.setGlobalPrefix('api');
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // ── Global middleware ─────────────────────────────────────────────────────
    const httpAdapterHost = app.get(HttpAdapterHost);
    app.useGlobalFilters(new HttpExceptionFilter(httpAdapterHost));
    app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,           // Strip unknown properties
            forbidNonWhitelisted: true, // Throw on unknown properties
            transform: true,           // Auto-transform payload to DTO class
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // ── WebSockets ────────────────────────────────────────────────────────────
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);

    // ── Swagger (dev/staging only) ────────────────────────────────────────────
    if (nodeEnv !== 'production') {
        const swaggerConfig = new DocumentBuilder()
            .setTitle('EduLanka API')
            .setDescription('EduLanka — National-scale educational SaaS REST API')
            .setVersion('1.0')
            .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
            .addTag('health', 'Service health checks')
            .addTag('auth', 'Authentication & token management')
            .addTag('tenants', 'School tenant management')
            .build();

        const document = SwaggerModule.createDocument(app, swaggerConfig);
        SwaggerModule.setup('api/docs', app, document, {
            swaggerOptions: { persistAuthorization: true },
        });

        logger.log(`Swagger UI: http://localhost:${port}/api/docs`);
    }

    await app.listen(port, '0.0.0.0');
    logger.log(`🚀 EduLanka API running on http://0.0.0.0:${port}/api/v1`);
}

void bootstrap();
