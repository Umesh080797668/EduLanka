import { Module, Global, Logger } from '@nestjs/common';
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
                const logger = new Logger('RedisClient');
                const url = configService.get('redis.url', { infer: true });
                const client = url
                    ? new Redis(url, {
                        lazyConnect: true,
                        enableReadyCheck: true,
                        maxRetriesPerRequest: 3,
                    })
                    : new Redis({
                        host: configService.get('redis.host', { infer: true }) ?? 'localhost',
                        port: configService.get('redis.port', { infer: true }) ?? 6379,
                        password: configService.get('redis.password', { infer: true }) || undefined,
                        lazyConnect: true,
                        enableReadyCheck: true,
                        maxRetriesPerRequest: 3,
                    });

                client.on('error', (err) => {
                    logger.warn(`Redis connection error: ${err.message}`);
                });

                return client;
            },
        },
        RedisService,
    ],
    exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule { }
