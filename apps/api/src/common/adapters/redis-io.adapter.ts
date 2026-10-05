import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter>;

    constructor(private app: INestApplicationContext) {
        super(app);
    }

    async connectToRedis(): Promise<void> {
        const configService = this.app.get(ConfigService);
        const redisUrl = configService.get<string>('redis.url');

        let pubClient: Redis;
        if (redisUrl) {
            pubClient = new Redis(redisUrl);
        } else {
            const host = configService.get<string>('redis.host', 'localhost');
            const port = configService.get<number>('redis.port', 6379);
            const password = configService.get<string>('redis.password');
            pubClient = new Redis({ host, port, password });
        }

        const subClient = pubClient.duplicate();

        await Promise.all([
            pubClient.connect().catch(() => { }), // ioredis might not need connect() if it auto-connects, but catch just in case
            subClient.connect().catch(() => { })
        ]);

        this.adapterConstructor = createAdapter(pubClient, subClient);
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const configService = this.app.get(ConfigService);
        const allowed = configService.get<string[]>('app.allowedOrigins', []);
        const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

        const corsOptions = {
            origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                if (!origin || nodeEnv === 'development' || allowed.includes('*') || allowed.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error(`CORS blocked origin: ${origin}`));
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
