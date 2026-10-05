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
            await this.redis.sadd(`edulanka:user_rts:${userId}`, jti);
            await this.redis.expire(`edulanka:user_rts:${userId}`, ttlSeconds);
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
            const userId = await this.redis.get(`${KEY_PREFIX}${jti}`);
            if (userId) {
                await this.redis.srem(`edulanka:user_rts:${userId}`, jti);
            }
            await this.redis.del(`${KEY_PREFIX}${jti}`);
        } catch (err) {
            this.logger.error(`Failed to revoke refresh token jti=${jti}`, err);
        }
    }

    /**
     * Revoke all active refresh tokens for a user (e.g., upon password change).
     */
    async revokeAllUserRefreshTokens(userId: string): Promise<void> {
        try {
            const jtis = await this.redis.smembers(`edulanka:user_rts:${userId}`);
            if (jtis && jtis.length > 0) {
                const keys = jtis.map((j) => `${KEY_PREFIX}${j}`);
                await this.redis.del(...keys);
            }
            await this.redis.del(`edulanka:user_rts:${userId}`);
            // Record revocation timestamp to invalidate existing access tokens issued before now
            const nowSeconds = Math.floor(Date.now() / 1000);
            await this.redis.set(`edulanka:user_revoked_at:${userId}`, nowSeconds.toString(), 'EX', 7 * 86400);
        } catch (err) {
            this.logger.error(`Failed to revoke all refresh tokens for userId=${userId}`, err);
        }
    }

    /**
     * Check if a token was issued prior to a full session revocation.
     */
    async isTokenRevoked(userId: string, iat?: number): Promise<boolean> {
        try {
            if (!iat) return false;
            const revokedAtStr = await this.redis.get(`edulanka:user_revoked_at:${userId}`);
            if (!revokedAtStr) return false;
            const revokedAt = parseInt(revokedAtStr, 10);
            return iat < revokedAt;
        } catch {
            return false;
        }
    }

    /**
     * Cache user active status to prevent database hits on every request.
     */
    async cacheUserActive(userId: string, isActive: boolean, ttlSeconds = 60): Promise<void> {
        try {
            await this.redis.set(`edulanka:user_active:${userId}`, isActive ? '1' : '0', 'EX', ttlSeconds);
        } catch {
            // non-fatal
        }
    }

    /**
     * Retrieve cached user active status. Returns null on cache miss.
     */
    async getCachedUserActive(userId: string): Promise<boolean | null> {
        try {
            const val = await this.redis.get(`edulanka:user_active:${userId}`);
            if (val === null) return null;
            return val === '1';
        } catch {
            return null;
        }
    }

    /**
     * Invalidate user active cache (e.g. when admin activates or deactivates user).
     */
    async invalidateUserActiveCache(userId: string): Promise<void> {
        try {
            await this.redis.del(`edulanka:user_active:${userId}`);
        } catch {
            // non-fatal
        }
    }
}
