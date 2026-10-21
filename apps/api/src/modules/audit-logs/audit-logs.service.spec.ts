import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import { AuditLogsService, AuditLogDto } from './audit-logs.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

describe('AuditLogsService', () => {
    let service: AuditLogsService;
    let mockSupabase: any;
    let mockRedis: any;
    const testLogPath = '/tmp/test_audit_fallback.log';

    beforeEach(async () => {
        process.env.AUDIT_LOG_FALLBACK_PATH = testLogPath;
        if (fs.existsSync(testLogPath)) {
            fs.unlinkSync(testLogPath);
        }

        mockSupabase = {
            adminClient: {
                from: jest.fn().mockReturnThis(),
                insert: jest.fn().mockResolvedValue({ error: null }),
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                range: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
            },
        };

        mockRedis = {
            client: {
                lpush: jest.fn().mockResolvedValue(1),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogsService,
                { provide: SupabaseService, useValue: mockSupabase },
                { provide: RedisService, useValue: mockRedis },
            ],
        }).compile();

        service = module.get<AuditLogsService>(AuditLogsService);
    });

    afterEach(() => {
        if (fs.existsSync(testLogPath)) {
            fs.unlinkSync(testLogPath);
        }
    });

    const sampleDto: AuditLogDto = {
        tenantId: 'tenant-123',
        actorId: 'user-456',
        actorRole: 'ADMIN',
        action: 'UPDATE_SETTINGS',
        entityType: 'TENANT',
        entityId: 'tenant-123',
        oldValues: { name: 'Old' },
        newValues: { name: 'New' },
        ipAddress: '127.0.0.1',
    };

    it('should queue to Redis when Redis is healthy', async () => {
        await service.logAction(sampleDto);
        expect(mockRedis.client.lpush).toHaveBeenCalledWith(
            'audit_events_queue',
            expect.stringContaining('UPDATE_SETTINGS')
        );
        expect(mockSupabase.adminClient.insert).not.toHaveBeenCalled();
    });

    it('should fall back to Supabase DB when Redis throws an error', async () => {
        mockRedis.client.lpush.mockRejectedValueOnce(new Error('Redis connection refused'));
        await service.logAction(sampleDto);

        expect(mockSupabase.adminClient.insert).toHaveBeenCalledWith(expect.objectContaining({
            action: 'UPDATE_SETTINGS',
            tenant_id: 'tenant-123',
        }));
        expect(fs.existsSync(testLogPath)).toBe(false);
    });

    it('should fall back to disk when both Redis and Supabase DB fail', async () => {
        mockRedis.client.lpush.mockRejectedValueOnce(new Error('Redis full'));
        mockSupabase.adminClient.insert.mockResolvedValueOnce({ error: { message: 'DB connection dead' } });

        await service.logAction(sampleDto);

        expect(fs.existsSync(testLogPath)).toBe(true);
        const content = fs.readFileSync(testLogPath, 'utf8');
        expect(content).toContain('UPDATE_SETTINGS');
        expect(content).toContain('tenant-123');
    });
});
