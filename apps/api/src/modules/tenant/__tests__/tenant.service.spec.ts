
import type { JwtPayload } from '@edu-lanka/shared-types';
import {
    TenantPlan,
    TenantStatus,
    SchoolType,
    UserRole,
} from '@edu-lanka/shared-types';
import { ForbiddenException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { TenantService } from '../tenant.service';
import { SupabaseService } from '../../supabase/supabase.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockTenantRow = {
    id: 'aaaabbbb-0000-0000-0000-000000000001',
    name: 'Test School',
    slug: 'test-school',
    plan: 'FREE',
    status: 'ACTIVE',
    school_type: 'TYPE_2',
    logo_url: null,
    contact_email: 'admin@test.lk',
    phone_number: null,
    address_street: null,
    address_city: 'Galle',
    address_district: 'Galle',
    address_province: 'Southern Province',
    address_postal: null,
    created_at: '2026-08-07T00:00:00Z',
    updated_at: '2026-08-07T00:00:00Z',
};

const superAdminCaller: JwtPayload = {
    sub: 'super-uid',
    tenantId: '',
    role: UserRole.SUPER_ADMIN,
    email: 'super@edulanka.lk',
};

const schoolAdminCaller: JwtPayload = {
    sub: 'admin-uid',
    tenantId: 'aaaabbbb-0000-0000-0000-000000000001',
    role: UserRole.SCHOOL_ADMIN,
    email: 'admin@test.lk',
};

const otherTenantCaller: JwtPayload = {
    sub: 'other-uid',
    tenantId: 'ffffffff-0000-0000-0000-000000000099',
    role: UserRole.SCHOOL_ADMIN,
    email: 'other@other.lk',
};

// ── Mock SupabaseService ──────────────────────────────────────────────────────

const buildMockSupabase = (overrides?: {
    insertErr?: object | null;
    rpcErr?: object | null;
    findData?: object | null;
    findErr?: object | null;
    updateData?: object | null;
    updateErr?: object | null;
    listData?: object[] | null;
    listErr?: object | null;
}) => {
    const o = overrides ?? {};
    const chainFor = (data: unknown, error: unknown) => ({
        select: () => chainFor(data, error),
        insert: () => chainFor(o.insertErr ? null : data, o.insertErr ?? null),
        update: () => chainFor(o.updateData ?? data, o.updateErr ?? null),
        eq: () => chainFor(data, error),
        maybeSingle: () => Promise.resolve({ data, error }),
        order: () => Promise.resolve({ data: o.listData ?? [], error: o.listErr ?? null }),
        single: () => Promise.resolve({ data: o.insertErr ? null : mockTenantRow, error: o.insertErr ?? null }),
        returns: () => Promise.resolve({ data: o.listData ?? [], error: o.listErr ?? null }),
    });

    return {
        adminClient: new Proxy(
            {},
            {
                get(_target, prop) {
                    if (prop === 'from') {
                        return () => chainFor('findData' in o ? o.findData : mockTenantRow, o.findErr ?? null);
                    }
                    if (prop === 'rpc') {
                        return () => Promise.resolve({ error: o.rpcErr ?? null });
                    }
                    return undefined;
                },
            },
        ),
    } as unknown as SupabaseService;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TenantService', () => {
    let service: TenantService;

    async function buildModule(supabaseMock: SupabaseService): Promise<void> {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TenantService,
                { provide: SupabaseService, useValue: supabaseMock },
            ],
        }).compile();
        service = module.get(TenantService);
    }

    const validDto = {
        name: 'Test School',
        slug: 'test-school',
        schoolType: SchoolType.TYPE_2,
        contactEmail: 'admin@test.lk',
        plan: TenantPlan.FREE,
    };

    // ── create() ──────────────────────────────────────────────────────────────

    describe('create()', () => {
        it('throws ForbiddenException when caller is not SUPER_ADMIN', async () => {
            await buildModule(buildMockSupabase());
            await expect(service.create(validDto, schoolAdminCaller))
                .rejects.toThrow(ForbiddenException);
        });

        it('returns the created tenant on success', async () => {
            await buildModule(buildMockSupabase());
            const result = await service.create(validDto, superAdminCaller);
            expect(result.slug).toBe('test-school');
            expect(result.status).toBe(TenantStatus.ACTIVE);
        });

        it('throws ConflictException on duplicate slug (Supabase code 23505)', async () => {
            await buildModule(buildMockSupabase({
                insertErr: { code: '23505', message: 'duplicate key' },
            }));
            await expect(service.create(validDto, superAdminCaller))
                .rejects.toThrow(ConflictException);
        });
    });

    // ── findOneById() ─────────────────────────────────────────────────────────

    describe('findOneById()', () => {
        it('returns the tenant when caller is the owner', async () => {
            await buildModule(buildMockSupabase());
            const result = await service.findOneById(
                'aaaabbbb-0000-0000-0000-000000000001',
                schoolAdminCaller,
            );
            expect(result.id).toBe('aaaabbbb-0000-0000-0000-000000000001');
        });

        it('allows SUPER_ADMIN to access any tenant', async () => {
            await buildModule(buildMockSupabase());
            const result = await service.findOneById(
                'aaaabbbb-0000-0000-0000-000000000001',
                superAdminCaller,
            );
            expect(result.id).toBe('aaaabbbb-0000-0000-0000-000000000001');
        });

        it('throws ForbiddenException for cross-tenant access', async () => {
            await buildModule(buildMockSupabase());
            await expect(
                service.findOneById('aaaabbbb-0000-0000-0000-000000000001', otherTenantCaller),
            ).rejects.toThrow(ForbiddenException);
        });

        it('throws NotFoundException when tenant does not exist', async () => {
            await buildModule(buildMockSupabase({ findData: null }));
            await expect(
                service.findOneById('aaaabbbb-0000-0000-0000-000000000001', superAdminCaller),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // ── listAll() ─────────────────────────────────────────────────────────────

    describe('listAll()', () => {
        it('throws ForbiddenException for non-SUPER_ADMIN callers', async () => {
            await buildModule(buildMockSupabase());
            await expect(service.listAll(schoolAdminCaller)).rejects.toThrow(ForbiddenException);
        });

        it('returns an array of tenants for SUPER_ADMIN', async () => {
            await buildModule(buildMockSupabase({ listData: [mockTenantRow] }));
            const results = await service.listAll(superAdminCaller);
            expect(Array.isArray(results)).toBe(true);
        });
    });

    // ── updateStatus() ────────────────────────────────────────────────────────

    describe('updateStatus()', () => {
        it('throws ForbiddenException for non-SUPER_ADMIN callers', async () => {
            await buildModule(buildMockSupabase());
            await expect(
                service.updateStatus(
                    'aaaabbbb-0000-0000-0000-000000000001',
                    { status: TenantStatus.SUSPENDED },
                    schoolAdminCaller,
                ),
            ).rejects.toThrow(ForbiddenException);
        });

        it('allows SUPER_ADMIN to suspend a tenant', async () => {
            await buildModule(buildMockSupabase({
                updateData: { ...mockTenantRow, status: 'SUSPENDED' },
            }));
            const result = await service.updateStatus(
                'aaaabbbb-0000-0000-0000-000000000001',
                { status: TenantStatus.SUSPENDED },
                superAdminCaller,
            );
            expect(result.status).toBe(TenantStatus.SUSPENDED);
        });
    });
});
