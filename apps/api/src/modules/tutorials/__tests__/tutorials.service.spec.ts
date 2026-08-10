import { Test, TestingModule } from '@nestjs/testing';
import { TutorialsService } from '../tutorials.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@edu-lanka/shared-types';

describe('TutorialsService', () => {
    let service: TutorialsService;
    let mockSupabaseService: any;
    let mockTenantDb: any;
    let mockAdminDb: any;

    beforeEach(async () => {
        mockTenantDb = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            upsert: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve({ data: [], error: null })),
        };

        mockAdminDb = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve({ data: [], error: null })),
        };

        mockSupabaseService = {
            getTenantClient: jest.fn().mockReturnValue(mockTenantDb),
            adminClient: mockAdminDb
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TutorialsService,
                { provide: SupabaseService, useValue: mockSupabaseService },
            ],
        }).compile();

        service = module.get<TutorialsService>(TutorialsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getTutorialForScreen', () => {
        it('should throw NotFoundException if no active tutorial found', async () => {
            mockAdminDb.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
            await expect(service.getTutorialForScreen('STUDENT', 'home')).rejects.toThrow(NotFoundException);
        });

        it('should fetch tutorial and steps successfully', async () => {
            mockAdminDb.single.mockResolvedValueOnce({ data: { id: 'tut-1', role: 'STUDENT' }, error: null });
            mockAdminDb.order.mockResolvedValueOnce({ data: [{ id: 'step-1' }], error: null });

            const result = await service.getTutorialForScreen('STUDENT', 'home');
            expect(result.success).toBe(true);
            expect(result.data.steps).toHaveLength(1);
        });
    });

    describe('updateUserStatus', () => {
        const caller = { sub: 'user-sub', role: UserRole.STUDENT, tenantId: 'tenant-1' } as any;

        it('should throw BadRequestException if tenant user mapping fails', async () => {
            mockTenantDb.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
            await expect(service.updateUserStatus('tut-1', 'COMPLETED', caller)).rejects.toThrow(BadRequestException);
        });

        it('should successfully update status', async () => {
            mockTenantDb.single.mockResolvedValueOnce({ data: { id: 'db-user-id' }, error: null }); // user fetch
            mockTenantDb.single.mockResolvedValueOnce({ data: { id: 'user-tut-1' }, error: null }); // upsert

            const result = await service.updateUserStatus('tut-1', 'COMPLETED', caller);
            expect(result.success).toBe(true);
        });
    });

    describe('getTenantStats', () => {
        const caller = { sub: 'admin-id', role: UserRole.SCHOOL_ADMIN, tenantId: 'tenant-1' } as any;

        it('should compile stats correctly', async () => {
            // 1. tutorials
            mockAdminDb.eq.mockResolvedValueOnce({ data: [{ id: 'tut-1', role: 'STUDENT' }], error: null });
            // 2. completions
            mockTenantDb.select.mockResolvedValueOnce({ data: [{ tutorial_id: 'tut-1', status: 'COMPLETED' }, { tutorial_id: 'tut-1', status: 'SKIPPED' }], error: null });
            // 3. users
            mockTenantDb.eq.mockResolvedValueOnce({ data: [{ role: 'STUDENT' }, { role: 'STUDENT' }], error: null }); // 2 eligible users

            const result = await service.getTenantStats(caller);
            expect(result.success).toBe(true);
            expect(result.data[0].eligible).toBe(2);
            expect(result.data[0].completed).toBe(1);
            expect(result.data[0].completionPercentage).toBe(50);
        });
    });
});
