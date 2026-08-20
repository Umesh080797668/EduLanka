import { Injectable, Inject, Logger } from '@nestjs/common';
import type Redis from 'ioredis';

const KEY_PREFIX = 'edulanka:rt:';

/**
 * RedisService — manages refresh-token lifecycle in Redis.
 *
 * Storage pattern: `edulanka:rt:{jti}` → `userId`
 *
 * - Stored at login/signup with the same TTL as the refresh JWT.
 * - Looked up during token rotation (POST /auth/refresh).
 * - Deleted on logout or rotation (single-use enforcement).
 */
@Injectable()
export class RedisService {
    private readonly logger = new Logger(RedisService.name);

    constructor(
        @Inject('REDIS_CLIENT') private readonly redis: Redis,
    ) { }

    public getClient(): Redis {
        return this.redis;
    }

    /**
     * Store a refresh-token jti in Redis.
     * @param jti    - JWT ID (unique per token)
     * @param userId - Tenant-scoped user UUID for audit purposes
     * @param ttlSeconds - Expiry aligned with the JWT `exp` claim
     */
    async storeRefreshToken(jti: string, userId: string, ttlSeconds: number): Promise<void> {
        try {
            await this.redis.set(`${KEY_PREFIX}${jti}`, userId, 'EX', ttlSeconds);
        } catch (err) {
            this.logger.error(`Failed to store refresh token jti=${jti}`, err);
            throw err;
        }
    }

    /**
     * Check whether a refresh-token jti is still valid (not revoked).
     */
    async isRefreshTokenValid(jti: string): Promise<boolean> {
        try {
            const result = await this.redis.exists(`${KEY_PREFIX}${jti}`);
            return result === 1;
        } catch (err) {
            this.logger.error(`Failed to check refresh token jti=${jti}`, err);
            return false;
        }
    }

    /**
     * Revoke a refresh-token jti (logout or rotation).
     */
    async revokeRefreshToken(jti: string): Promise<void> {
        try {
            await this.redis.del(`${KEY_PREFIX}${jti}`);
        } catch (err) {
            this.logger.error(`Failed to revoke refresh token jti=${jti}`, err);
            // Non-fatal — log and continue; the JWT will expire naturally
        }
    }
}
