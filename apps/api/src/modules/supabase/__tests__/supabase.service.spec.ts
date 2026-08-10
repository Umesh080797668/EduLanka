import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../supabase.service';
import { ConfigService } from '@nestjs/config';

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockReturnValue({ auth: {}, db: {} })
}));

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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should initialize admin client on module init', () => {
        service.onModuleInit();
        expect(createClient).toHaveBeenCalledWith('http://mock-supabase.local', 'mock-key', expect.objectContaining({
            db: { schema: 'public' }
        }));
        expect(service.adminClient).toBeDefined();
    });

    it('should return a tenant client correctly scoped to tenant schema', () => {
        const tenantClient = service.getTenantClient('dev-school');
        expect(createClient).toHaveBeenCalledWith('http://mock-supabase.local', 'mock-key', expect.objectContaining({
            db: { schema: 'tenant_dev-school' }
        }));
        expect(tenantClient).toBeDefined();
    });
});
