import { UserRole } from '@edu-lanka/shared-types';
import { getQueueToken } from '@nestjs/bullmq';
import { ForbiddenException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../../supabase/supabase.service';
import { TenantService } from '../../tenant/tenant.service';
import { ReportCardsService, BULK_REPORT_CARDS_QUEUE_NAME } from '../report-cards.service';

describe('ReportCardsService', () => {
    let service: ReportCardsService;
    let tenantService: TenantService;
    let supabaseService: SupabaseService;
    let mockQueue: any;

    beforeEach(async () => {
        mockQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job-bulk-123' }),
            getJob: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportCardsService,
                {
                    provide: SupabaseService,
                    useValue: { getTenantClient: jest.fn() }
                },
                {
                    provide: TenantService,
                    useValue: { findOneById: jest.fn() }
                },
                {
                    provide: getQueueToken(BULK_REPORT_CARDS_QUEUE_NAME),
                    useValue: mockQueue,
                },
            ],
        }).compile();

        service = module.get<ReportCardsService>(ReportCardsService);
        tenantService = module.get<TenantService>(TenantService);
        supabaseService = module.get<SupabaseService>(SupabaseService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should strictly request the tenant DB client using the UUID (tenant.id) instead of the slug', async () => {
        const mockTenantId = '1234abcd-1234-abcd-1234-abcd1234abcd';
        const caller: any = { tenantId: mockTenantId, sub: 'u1', role: UserRole.STUDENT };

        jest.spyOn(tenantService, 'findOneById').mockResolvedValue({
            id: mockTenantId,
            slug: 'test-slug',
            name: 'Test Tenant'
        } as any);

        const mockQueryBuilder = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
        };

        const getTenantClientSpy = jest.spyOn(supabaseService, 'getTenantClient').mockReturnValue(mockQueryBuilder as any);

        try {
            await service.generateReportCard('student-123', 1, 2026, caller);
        } catch (e) {
            // InternalServerErrorException from "Error gathering marks"
        }

        expect(getTenantClientSpy).toHaveBeenCalledWith(mockTenantId);
        expect(getTenantClientSpy).not.toHaveBeenCalledWith('test-slug');
    });

    it('should queue a bulk report card generation job for school admins', async () => {
        const caller: any = {
            tenantId: '1234abcd-1234-abcd-1234-abcd1234abcd',
            sub: 'admin-user-1',
            role: UserRole.SCHOOL_ADMIN,
        };

        const result = await service.queueBulkReportCardGeneration(
            { term: 1, academicYear: 2026, classId: 'class-uuid-1' },
            caller,
        );

        expect(result.success).toBe(true);
        expect(result.jobId).toBe('job-bulk-123');
        expect(mockQueue.add).toHaveBeenCalledWith(
            'generate-bulk-report-cards',
            expect.objectContaining({
                tenantId: caller.tenantId,
                term: 1,
                academicYear: 2026,
                classId: 'class-uuid-1',
                triggeredBy: caller.sub,
            }),
            expect.any(Object),
        );
    });

    it('should reject non-admin/teacher callers from queueing bulk report cards', async () => {
        const studentCaller: any = {
            tenantId: '1234abcd-1234-abcd-1234-abcd1234abcd',
            sub: 'student-user-1',
            role: UserRole.STUDENT,
        };

        await expect(
            service.queueBulkReportCardGeneration({ term: 1, academicYear: 2026 }, studentCaller),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should retrieve job status from BullMQ queue', async () => {
        const caller: any = {
            tenantId: '1234abcd-1234-abcd-1234-abcd1234abcd',
            sub: 'admin-user-1',
            role: UserRole.SCHOOL_ADMIN,
        };

        mockQueue.getJob.mockResolvedValueOnce({
            id: 'job-bulk-123',
            data: { tenantId: caller.tenantId, term: 1, academicYear: 2026 },
            getState: jest.fn().mockResolvedValue('completed'),
            progress: { completed: 30, total: 30, percentage: 100 },
            returnvalue: { generatedCount: 30, failedCount: 0 },
        });

        const status = await service.getBulkJobStatus('job-bulk-123', caller);
        expect(status.state).toBe('completed');
        expect(status.progress).toEqual({ completed: 30, total: 30, percentage: 100 });
        expect(status.result).toEqual({ generatedCount: 30, failedCount: 0 });
    });
});
