import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import { SupabaseService } from '../supabase.service';


jest.mock('@supabase/supabase-js', () => {
    const mockFromObj = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
    };
    return {
        createClient: jest.fn().mockReturnValue({
            auth: {},
            from: jest.fn().mockReturnValue(mockFromObj),
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
        const tenantClient = service.getTenantClient('tenant-uuid-123');
        expect(tenantClient).toBeDefined();

        const query = tenantClient.from('students').select('*');
        expect(query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-uuid-123');
    });
});
