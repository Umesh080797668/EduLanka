import { Logger, type INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
    private readonly redisLogger = new Logger(RedisIoAdapter.name);
    private adapterConstructor: ReturnType<typeof createAdapter>;

    constructor(private app: INestApplicationContext) {
        super(app);
    }

    async connectToRedis(): Promise<void> {
        const configService = this.app.get(ConfigService);
        const redisUrl = configService.get<string>('redis.url');

        let pubClient: Redis;

        if (redisUrl) {
            pubClient = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 3,
            });
        } else {
            const host = configService.get<string>('redis.host', 'localhost');
            const port = configService.get<number>('redis.port', 6379);
            const password = configService.get<string>('redis.password');

            pubClient = new Redis({
                host,
                port,
                password,
                lazyConnect: true,
                maxRetriesPerRequest: 3,
            });
        }

        pubClient.on('error', (err) => {
            this.redisLogger.warn(
                `Redis pub client error: ${err.message}`,
            );
        });

        const subClient = pubClient.duplicate();

        subClient.on('error', (err) => {
            this.redisLogger.warn(
                `Redis sub client error: ${err.message}`,
            );
        });

        await Promise.all([
            pubClient.connect().catch((err) => {
                this.redisLogger.warn(
                    `Redis pub client initial connect failed: ${err.message}`,
                );
            }),

            subClient.connect().catch((err) => {
                this.redisLogger.warn(
                    `Redis sub client initial connect failed: ${err.message}`,
                );
            }),
        ]);

        this.adapterConstructor = createAdapter(
            pubClient,
            subClient,
        );
    }

    createIOServer(
        port: number,
        options?: ServerOptions,
    ): any {
        const configService = this.app.get(ConfigService);

        const allowed = configService.get<string[]>(
            'app.allowedOrigins',
            [],
        );

        const nodeEnv = configService.get<string>(
            'app.nodeEnv',
            'development',
        );

        const corsOptions = {
            origin: (
                origin: string | undefined,
                callback: (
                    err: Error | null,
                    allow?: boolean,
                ) => void,
            ) => {
                if (
                    !origin ||
                    nodeEnv === 'development' ||
                    allowed.includes('*') ||
                    allowed.includes(origin)
                ) {
                    callback(null, true);
                } else {
                    callback(
                        new Error(`CORS blocked origin: ${origin}`),
                    );
                }
            },
            credentials: true,
        };

        const server = super.createIOServer(port, {
            ...options,
            cors: corsOptions,
        });

        server.adapter(this.adapterConstructor);

        return server;
    }
}
