import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../supabase.service';


jest.mock('@supabase/supabase-js', () => {
    return {
        createClient: jest.fn().mockReturnValue({
            auth: {},
            from: jest.fn().mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                delete: jest.fn().mockReturnThis(),
                insert: jest.fn().mockReturnThis(),
                upsert: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            })),
        }),
    };
});

import { createClient } from '@supabase/supabase-js';

describe('SupabaseService', () => {
    let service: SupabaseService;
    let mockConfigService: any;

    beforeEach(async () => {
        mockConfigService = {
            get: jest.fn((key: string) => {
                if (key === 'supabase.url') return 'http://mock-supabase.local';
                if (key === 'supabase.serviceRoleKey') return 'mock-key';
                return null;
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SupabaseService,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<SupabaseService>(SupabaseService);
        service.onModuleInit();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should initialize admin client on module init', () => {
        expect(createClient).toHaveBeenCalledWith('http://mock-supabase.local', 'mock-key', expect.objectContaining({
            db: { schema: 'public' }
        }));
        expect(service.adminClient).toBeDefined();
    });

    it('should return a tenant client correctly scoped to tenant with tenant_id injection', () => {
        const tenantId = '45f9722b-eda0-453f-88d2-2c9ad06ec169';
        const tenantClient = service.getTenantClient(tenantId);
        expect(tenantClient).toBeDefined();

        const query = tenantClient.from('students').select('*');
        expect(query.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    });

    it('should reject invalid tenant UUID format', () => {
        expect(() => service.getTenantClient('invalid-slug')).toThrow();
    });

    it('should exempt notice_reads from tenant_id filter', () => {
        const tenantId = '45f9722b-eda0-453f-88d2-2c9ad06ec169';
        const tenantClient = service.getTenantClient(tenantId);
        const query = (tenantClient.from('notice_reads') as any).select('*');
        expect(query.eq).not.toHaveBeenCalled();
    });
});
