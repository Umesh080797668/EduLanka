import type { JwtPayload, Tenant } from '@edu-lanka/shared-types';
import {
    TenantPlan,
    TenantStatus,
    UserRole,
    SchoolType,
} from '@edu-lanka/shared-types';
import {
    Injectable,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTenantDto } from './tenant.controller';

/** Shape returned from public.tenants Supabase query */
interface TenantRow {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    school_type: string;
    logo_url: string | null;
    contact_email: string;
    phone_number: string | null;
    address_street: string | null;
    address_city: string | null;
    address_district: string | null;
    address_province: string | null;
    address_postal: string | null;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class TenantService {
    private readonly logger = new Logger(TenantService.name);

    constructor(private readonly supabase: SupabaseService) { }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private rowToTenant(row: TenantRow): Tenant {
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            plan: row.plan as TenantPlan,
            status: row.status as TenantStatus,
            schoolType: row.school_type as SchoolType,
            logoUrl: row.logo_url ?? undefined,
            contactEmail: row.contact_email,
            phoneNumber: row.phone_number ?? undefined,
            address: row.address_city
                ? {
                    street: row.address_street ?? undefined,
                    city: row.address_city,
                    district: row.address_district ?? '',
                    province: row.address_province ?? '',
                    postalCode: row.address_postal ?? undefined,
                }
                : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    // ── Public methods ────────────────────────────────────────────────────────

    /**
     * POST /api/v1/tenants
     * Inserts into public.tenants and calls create_tenant_schema() RPC.
     * Only SUPER_ADMIN can create tenants.
     */
    async create(dto: CreateTenantDto, caller: JwtPayload): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can provision tenants');
        }

        // 1. Insert registry row (status = PROVISIONING)
        const { data: inserted, error: insertErr } = await this.supabase.adminClient
            .from('tenants')
            .insert({
                name: dto.name,
                slug: dto.slug,
                plan: dto.plan ?? TenantPlan.FREE,
                status: TenantStatus.PROVISIONING,
                school_type: dto.schoolType,
                contact_email: dto.contactEmail,
            })
            .select()
            .single();

        if (insertErr) {
            if (insertErr.code === '23505') {
                throw new ConflictException(`Slug "${dto.slug}" is already in use`);
            }
            this.logger.error(`Failed to insert tenant: ${insertErr.message}`);
            throw new InternalServerErrorException('Failed to create tenant');
        }

        // 2. Provision the per-tenant schema via stored procedure
        const { error: rpcErr } = await this.supabase.adminClient.rpc(
            'create_tenant_schema_sprint4_override',
            { p_slug: dto.slug },
        );

        if (rpcErr) {
            // Schema creation failed — mark as DEPROVISIONED so it's visible
            await this.supabase.adminClient
                .from('tenants')
                .update({ status: TenantStatus.DEPROVISIONED })
                .eq('id', inserted.id);

            this.logger.error(`Schema provisioning failed for ${dto.slug}: ${rpcErr.message}`);
            throw new InternalServerErrorException('Schema provisioning failed');
        }

        this.logger.log(`Provisioned tenant "${dto.slug}" (${inserted.id})`);
        return this.rowToTenant(inserted as TenantRow);
    }

    /**
     * GET /api/v1/tenants/:id
     * Retrieve a tenant. Users can only access their own tenantId
     * unless they are SUPER_ADMIN.
     */
    async findOneById(id: string, caller: JwtPayload): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN && caller.tenantId !== id) {
            throw new ForbiddenException('Access to this tenant is not permitted');
        }

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            this.logger.error(`Tenant lookup error: ${error.message}`);
            throw new InternalServerErrorException('Tenant lookup failed');
        }

        if (!data) {
            throw new NotFoundException(`Tenant ${id} not found`);
        }

        return this.rowToTenant(data as TenantRow);
    }

    /**
     * GET /api/v1/tenants
     * List all tenants — SUPER_ADMIN only.
     */
    async listAll(caller: JwtPayload): Promise<Tenant[]> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can list all tenants');
        }

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error(`Tenant list error: ${error.message}`);
            throw new InternalServerErrorException('Failed to list tenants');
        }

        return (data ?? []).map((row) => this.rowToTenant(row as TenantRow));
    }

    /**
     * PATCH /api/v1/tenants/:id/status
     * Update tenant lifecycle status — SUPER_ADMIN only.
     */
    async updateStatus(
        id: string,
        status: TenantStatus,
        caller: JwtPayload,
    ): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can change tenant status');
        }

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .update({ status })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            this.logger.error(`Tenant status update error: ${error.message}`);
            throw new InternalServerErrorException('Status update failed');
        }

        if (!data) {
            throw new NotFoundException(`Tenant ${id} not found`);
        }

        return this.rowToTenant(data as TenantRow);
    }
}
