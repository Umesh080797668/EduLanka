import type { JwtPayload } from '@edu-lanka/shared-types';

/**
 * Augments Fastify's request type with the `user` property populated by
 * Passport's JwtStrategy after JwtAuthGuard validates the bearer token.
 * See: modules/auth/strategies/jwt.strategy.ts (validate() return value).
 */
declare module 'fastify' {
    interface FastifyRequest {
        user?: JwtPayload;
    }
}
