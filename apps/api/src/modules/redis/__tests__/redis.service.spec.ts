import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis.service';
import { Logger } from '@nestjs/common';

describe('RedisService', () => {
    let service: RedisService;
    let mockRedisClient: any;

    beforeEach(async () => {
        mockRedisClient = {
            set: jest.fn(),
            exists: jest.fn(),
            del: jest.fn(),
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
            await service.storeRefreshToken('jti-1', 'user-1', 3600);
            expect(mockRedisClient.set).toHaveBeenCalledWith('edulanka:rt:jti-1', 'user-1', 'EX', 3600);
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
        it('should delete the token', async () => {
            mockRedisClient.del.mockResolvedValueOnce(1);
            await service.revokeRefreshToken('jti-1');
            expect(mockRedisClient.del).toHaveBeenCalledWith('edulanka:rt:jti-1');
        });

        it('should log and not throw if delete fails', async () => {
            mockRedisClient.del.mockRejectedValueOnce(new Error('redis error'));
            const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => { });

            await expect(service.revokeRefreshToken('jti-1')).resolves.not.toThrow();
            expect(loggerSpy).toHaveBeenCalled();
            loggerSpy.mockRestore();
        });
    });
});
