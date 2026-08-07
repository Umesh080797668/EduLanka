
import type { JwtPayload, Tenant } from '@edu-lanka/shared-types';
import { TenantPlan, TenantStatus, UserRole } from '@edu-lanka/shared-types';
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { CreateTenantDto } from './tenant.controller';

@Injectable()
export class TenantService {
    /**
     * Provision a new school tenant.
     * Only SUPER_ADMIN can create tenants.
     *
     * TODO (Phase 1): Persist to Supabase, provision schema, seed roles.
     */
    create(dto: CreateTenantDto, caller: JwtPayload): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can provision tenants');
        }

        // Stub — real implementation wires Supabase client
        const now = new Date().toISOString();
        return Promise.resolve({
            id: crypto.randomUUID(),
            name: dto.name,
            slug: dto.slug,
            plan: dto.plan ?? TenantPlan.FREE,
            status: TenantStatus.PROVISIONING,
            schoolType: dto.schoolType,
            contactEmail: dto.contactEmail,
            createdAt: now,
            updatedAt: now,
        });
    }

    /**
     * Retrieve a tenant. Callers can only access their own tenantId
     * unless they are SUPER_ADMIN.
     *
     * TODO (Phase 1): Query Supabase tenants table.
     */
    findOneById(id: string, caller: JwtPayload): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN && caller.tenantId !== id) {
            throw new ForbiddenException('Access to this tenant is not permitted');
        }

        // Stub
        throw new NotFoundException(`Tenant ${id} not found — Supabase integration pending`);
    }
}
