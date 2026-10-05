import { Logger } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { RedisService } from '../redis.service';


describe('RedisService', () => {
    let service: RedisService;
    let mockRedisClient: any;

    beforeEach(async () => {
        mockRedisClient = {
            set: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue(null),
            exists: jest.fn().mockResolvedValue(1),
            del: jest.fn().mockResolvedValue(1),
            sadd: jest.fn().mockResolvedValue(1),
            srem: jest.fn().mockResolvedValue(1),
            smembers: jest.fn().mockResolvedValue([]),
            expire: jest.fn().mockResolvedValue(1),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RedisService,
                { provide: 'REDIS_CLIENT', useValue: mockRedisClient },
            ],
        }).compile();

        service = module.get<RedisService>(RedisService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('storeRefreshToken', () => {
        it('should successfully store token', async () => {
            mockRedisClient.set.mockResolvedValueOnce('OK');
            mockRedisClient.sadd.mockResolvedValueOnce(1);
            mockRedisClient.expire.mockResolvedValueOnce(1);
            await service.storeRefreshToken('jti-1', 'user-1', 3600);
            expect(mockRedisClient.set).toHaveBeenCalledWith('edulanka:rt:jti-1', 'user-1', 'EX', 3600);
            expect(mockRedisClient.sadd).toHaveBeenCalledWith('edulanka:user_rts:user-1', 'jti-1');
            expect(mockRedisClient.expire).toHaveBeenCalledWith('edulanka:user_rts:user-1', 3600);
        });

        it('should throw and log if storing fails', async () => {
            mockRedisClient.set.mockRejectedValueOnce(new Error('redis error'));
            const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });

            await expect(service.storeRefreshToken('jti-1', 'user-1', 3600)).rejects.toThrow('redis error');
            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });
    });

    describe('isRefreshTokenValid', () => {
        it('should return true if token exists', async () => {
            mockRedisClient.exists.mockResolvedValueOnce(1);
            const result = await service.isRefreshTokenValid('jti-1');
            expect(result).toBe(true);
        });

        it('should return false if token does not exist', async () => {
            mockRedisClient.exists.mockResolvedValueOnce(0);
            const result = await service.isRefreshTokenValid('jti-1');
            expect(result).toBe(false);
        });

        it('should return false if redis throws', async () => {
            mockRedisClient.exists.mockRejectedValueOnce(new Error('redis error'));
            const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });

            const result = await service.isRefreshTokenValid('jti-1');
            expect(result).toBe(false);
            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });
    });

    describe('revokeRefreshToken', () => {
        it('should delete the token and remove from user set', async () => {
            mockRedisClient.get.mockResolvedValueOnce('user-1');
            mockRedisClient.srem.mockResolvedValueOnce(1);
            mockRedisClient.del.mockResolvedValueOnce(1);
            await service.revokeRefreshToken('jti-1');
            expect(mockRedisClient.get).toHaveBeenCalledWith('edulanka:rt:jti-1');
            expect(mockRedisClient.srem).toHaveBeenCalledWith('edulanka:user_rts:user-1', 'jti-1');
            expect(mockRedisClient.del).toHaveBeenCalledWith('edulanka:rt:jti-1');
        });

        it('should log and not throw if delete fails', async () => {
            mockRedisClient.get.mockRejectedValueOnce(new Error('redis error'));
            const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });

            await expect(service.revokeRefreshToken('jti-1')).resolves.not.toThrow();
            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });
    });

    describe('revokeAllUserRefreshTokens', () => {
        it('should delete all JTIs and user set, then store revocation timestamp', async () => {
            mockRedisClient.smembers.mockResolvedValueOnce(['jti-a', 'jti-b']);
            mockRedisClient.del.mockResolvedValue(2);
            mockRedisClient.set.mockResolvedValue('OK');

            await service.revokeAllUserRefreshTokens('user-1');

            expect(mockRedisClient.smembers).toHaveBeenCalledWith('edulanka:user_rts:user-1');
            expect(mockRedisClient.del).toHaveBeenCalledWith('edulanka:rt:jti-a', 'edulanka:rt:jti-b');
            expect(mockRedisClient.del).toHaveBeenCalledWith('edulanka:user_rts:user-1');
            expect(mockRedisClient.set).toHaveBeenCalledWith(
                'edulanka:user_revoked_at:user-1',
                expect.any(String),
                'EX',
                7 * 86400,
            );
        });
    });

    describe('isTokenRevoked', () => {
        it('should return false when no iat provided', async () => {
            const result = await service.isTokenRevoked('user-1');
            expect(result).toBe(false);
        });

        it('should return true if token was issued prior to revocation timestamp', async () => {
            mockRedisClient.get.mockResolvedValueOnce('1700000100');
            const result = await service.isTokenRevoked('user-1', 1700000000);
            expect(result).toBe(true);
        });

        it('should return false if token was issued after revocation timestamp', async () => {
            mockRedisClient.get.mockResolvedValueOnce('1700000000');
            const result = await service.isTokenRevoked('user-1', 1700000100);
            expect(result).toBe(false);
        });
    });

    describe('cacheUserActive and getCachedUserActive', () => {
        it('should cache and retrieve user active status', async () => {
            await service.cacheUserActive('user-1', true, 60);
            expect(mockRedisClient.set).toHaveBeenCalledWith('edulanka:user_active:user-1', '1', 'EX', 60);

            mockRedisClient.get.mockResolvedValueOnce('1');
            const active = await service.getCachedUserActive('user-1');
            expect(active).toBe(true);

            mockRedisClient.get.mockResolvedValueOnce('0');
            const inactive = await service.getCachedUserActive('user-1');
            expect(inactive).toBe(false);

            mockRedisClient.get.mockResolvedValueOnce(null);
            const miss = await service.getCachedUserActive('user-1');
            expect(miss).toBeNull();
        });
    });
});
