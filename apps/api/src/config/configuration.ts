/**
 * Typed configuration factory.
 * All env vars are validated by Joi in AppModule before this runs.
 */
export const configuration = () => ({
    app: {
        nodeEnv: process.env['NODE_ENV'] ?? 'development',
        port: parseInt(process.env['PORT'] ?? '3001', 10),
        allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000')
            .split(',')
            .map((o) => o.trim()),
        publicUrl: process.env['APP_PUBLIC_URL'] ?? 'http://localhost:3000',
    },
    supabase: {
        url: process.env['SUPABASE_URL'] as string,
        serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] as string,
    },
    redis: {
        url: process.env['REDIS_URL'] as string | undefined,
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        password: process.env['REDIS_PASSWORD'] ?? '',
    },
    jwt: {
        secret: process.env['JWT_SECRET'] as string,
        expiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
        refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',
    },
});

export type AppConfiguration = ReturnType<typeof configuration>;
