import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppConfiguration } from '../../config/configuration';
import { RedisService } from './redis.service';

/**
 * Global RedisModule — provides an ioredis client + RedisService
 * to the entire application without needing explicit imports.
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: 'REDIS_CLIENT',
            inject: [ConfigService],
            useFactory: (configService: ConfigService<AppConfiguration>) => {
                const host = configService.get('redis.host', { infer: true }) ?? 'localhost';
                const port = configService.get('redis.port', { infer: true }) ?? 6379;
                const password = configService.get('redis.password', { infer: true });

                return new Redis({
                    host,
                    port,
                    password: password || undefined,
                    lazyConnect: true,      // Don't die at startup if Redis is unreachable
                    enableReadyCheck: true,
                    maxRetriesPerRequest: 3,
                });
            },
        },
        RedisService,
    ],
    exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }
