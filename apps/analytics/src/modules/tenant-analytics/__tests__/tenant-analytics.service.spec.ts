import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { TenantAnalyticsService } from '../tenant-analytics.service';

describe('TenantAnalyticsService', () => {
    let service: TenantAnalyticsService;
    let mockPrisma: { query: jest.Mock };

    beforeEach(async () => {
        mockPrisma = {
            query: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TenantAnalyticsService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<TenantAnalyticsService>(TenantAnalyticsService);
    });

    it('should query active students per tenant with billing month', async () => {
        mockPrisma.query.mockResolvedValueOnce([
            {
                tenantId: 't-1',
                tenantName: 'Royal College',
                plan: 'GROWTH',
                activeStudentCount: 450,
            },
        ]);

        const result = await service.getActiveStudents('2026-10');
        expect(mockPrisma.query).toHaveBeenCalledTimes(1);
        expect(result.length).toBe(1);
        expect(result[0].billingMonth).toBe('2026-10');
        expect(result[0].activeStudentCount).toBe(450);
    });

    it('should query storage usage vs quotas', async () => {
        mockPrisma.query.mockResolvedValueOnce([
            {
                tenantId: 't-1',
                tenantName: 'Royal College',
                plan: 'GROWTH',
                storageQuotaGb: 20,
                totalBytesUsed: 5368709120,
                totalGbUsed: 5.0,
                isQuotaExceeded: false,
            },
        ]);

        const result = await service.getStorageUsage();
        expect(result.length).toBe(1);
        expect(result[0].storageQuotaGb).toBe(20);
        expect(result[0].isQuotaExceeded).toBe(false);
    });

    it('should query mobile sync health and stale device counts', async () => {
        mockPrisma.query.mockResolvedValueOnce([
            {
                tenantId: 't-1',
                tenantName: 'Royal College',
                totalDevices: 120,
                staleDevices: 4,
                latestActivityAt: '2026-10-12T10:00:00.000Z',
            },
        ]);

        const result = await service.getSyncHealth(3);
        expect(mockPrisma.query).toHaveBeenCalledWith(expect.any(String), [3]);
        expect(result[0].totalDevices).toBe(120);
        expect(result[0].staleDevices).toBe(4);
    });

    it('should aggregate media downloads from media_download_logs', async () => {
        mockPrisma.query.mockResolvedValueOnce([
            {
                subject: 'Science',
                downloadCount: 85,
                uniqueDownloadersCount: 40,
                totalDownloadedBytes: 4456448000,
                distinctAssetsDownloaded: 12,
            },
        ]);

        const result = await service.getMediaDownloads();
        expect(result.length).toBe(1);
        expect(result[0].subject).toBe('Science');
        expect(result[0].downloadCount).toBe(85);
    });

    it('should fallback to catalog breakdown if no media downloads exist yet', async () => {
        mockPrisma.query
            .mockResolvedValueOnce([]) // No rows from downloadLogsSql
            .mockResolvedValueOnce([
                {
                    subject: 'Mathematics',
                    downloadCount: 0,
                    uniqueDownloadersCount: 0,
                    totalDownloadedBytes: 0,
                    distinctAssetsDownloaded: 15,
                    downloadableCount: 15,
                },
            ]);

        const result = await service.getMediaDownloads();
        expect(mockPrisma.query).toHaveBeenCalledTimes(2);
        expect(result.length).toBe(1);
        expect(result[0].subject).toBe('Mathematics');
        expect(result[0].downloadableCount).toBe(15);
    });

    it('should retrieve billing snapshots centrally without duplicate writes (§7c)', async () => {
        mockPrisma.query.mockResolvedValueOnce([
            {
                id: 'snap-1',
                tenantId: 't-1',
                tenantName: 'Royal College',
                billingMonth: '2026-10',
                plan: 'GROWTH',
                activeStudentCount: 200,
                baseFeeLkr: 15000,
                perStudentFeeLkr: 50,
                smsCount: 150,
                smsOverageChargeLkr: 100,
                totalAmountLkr: 25100, // 15000 + (200 * 50) + 100 = 25100
                status: 'DRAFT',
            },
        ]);

        const result = await service.generateBillingSnapshots('2026-10');
        expect(result.length).toBe(1);
        expect(result[0].totalAmountLkr).toBe(25100);
    });
});
