// =============================================================================
// EduLanka — Sponsorship Automation Service
// Calculates 10% of net profit into public.sponsorship_pools (monthly),
// automatically downgrades expired grants back to from_plan,
// and exposes admin methods for awarding / revoking grants.
// =============================================================================
import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { GrantEventType } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';

export interface AwardGrantDto {
    beneficiaryType: 'SCHOOL' | 'INDEPENDENT_LEARNER';
    beneficiaryId: string;
    fromPlan: string;
    toPlan: string;
    expiresAt: string; // ISO timestamp
    poolId?: string;
    estimatedCostLkr?: number;
    notes?: string;
}

export interface RevokeGrantDto {
    reason?: string;
}

@Injectable()
export class SponsorshipService {
    private readonly logger = new Logger(SponsorshipService.name);

    constructor(private readonly supabase: SupabaseService) { }

    // ─── Internal helper ─────────────────────────────────────────────────────

    private guardSuperAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only Super Admins can manage sponsorship grants');
        }
    }

    // ─── Pool Management ─────────────────────────────────────────────────────

    /**
     * Monthly job: calculates 10% of net profit and writes/upserts
     * a row into public.sponsorship_pools for the given billing month.
     *
     * Designed to be called from the BillingProcessor nightly cron or a
     * standalone scheduled POST /system-admin/sponsorship/pools/calculate.
     */
    async calculateMonthlyPool(
        billingMonth: string,
        netProfitLkr: number,
        caller: JwtPayload,
    ): Promise<any> {
        this.guardSuperAdmin(caller);

        const POOL_FRACTION = 0.10;
        const poolAmountLkr = Math.max(0, netProfitLkr * POOL_FRACTION);

        const { data: existing } = await this.supabase.adminClient
            .from('sponsorship_pools')
            .select('id, remaining_lkr')
            .eq('period_month', `${billingMonth}-01`)
            .maybeSingle();

        if (existing) {
            // Update net_profit and recalculate pool_amount; do not reduce remaining below 0
            const prevPoolAmount = (existing as any).pool_amount_lkr ?? 0;
            const newRemaining = Math.max(0, existing.remaining_lkr + (poolAmountLkr - prevPoolAmount));
            const { data, error } = await this.supabase.adminClient
                .from('sponsorship_pools')
                .update({
                    net_profit_lkr: netProfitLkr,
                    pool_fraction: POOL_FRACTION,
                    pool_amount_lkr: poolAmountLkr,
                    remaining_lkr: newRemaining,
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw new InternalServerErrorException(`Failed to update sponsorship pool: ${error.message}`);
            return data;
        }

        const { data, error } = await this.supabase.adminClient
            .from('sponsorship_pools')
            .insert({
                period_month: `${billingMonth}-01`,
                net_profit_lkr: netProfitLkr,
                pool_fraction: POOL_FRACTION,
                pool_amount_lkr: poolAmountLkr,
                remaining_lkr: poolAmountLkr,
            })
            .select()
            .single();

        if (error) throw new InternalServerErrorException(`Failed to create sponsorship pool: ${error.message}`);
        this.logger.log(`Sponsorship pool created for ${billingMonth}: LKR ${poolAmountLkr.toLocaleString()}`);
        return data;
    }

    async listPools(caller: JwtPayload): Promise<any[]> {
        this.guardSuperAdmin(caller);

        const { data, error } = await this.supabase.adminClient
            .from('sponsorship_pools')
            .select('*')
            .order('period_month', { ascending: false });

        if (error) throw new InternalServerErrorException(`Failed to list sponsorship pools: ${error.message}`);
        return data ?? [];
    }

    // ─── Grant Management ─────────────────────────────────────────────────────

    async awardGrant(dto: AwardGrantDto, caller: JwtPayload): Promise<any> {
        this.guardSuperAdmin(caller);

        const expiresAt = new Date(dto.expiresAt);
        if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
            throw new BadRequestException('expiresAt must be a valid future ISO timestamp');
        }

        // Verify beneficiary exists
        if (dto.beneficiaryType === 'INDEPENDENT_LEARNER') {
            const { data: learner } = await this.supabase.adminClient
                .from('independent_learners')
                .select('id')
                .eq('id', dto.beneficiaryId)
                .maybeSingle();
            if (!learner) throw new NotFoundException(`Independent learner ${dto.beneficiaryId} not found`);
        } else if (dto.beneficiaryType === 'SCHOOL') {
            const { data: tenant } = await this.supabase.adminClient
                .from('tenants')
                .select('id')
                .eq('id', dto.beneficiaryId)
                .maybeSingle();
            if (!tenant) throw new NotFoundException(`Tenant ${dto.beneficiaryId} not found`);
        }

        // Deduct from pool remaining_lkr if a pool is specified
        if (dto.poolId && dto.estimatedCostLkr && dto.estimatedCostLkr > 0) {
            const { data: pool } = await this.supabase.adminClient
                .from('sponsorship_pools')
                .select('remaining_lkr')
                .eq('id', dto.poolId)
                .maybeSingle();

            if (!pool) throw new NotFoundException(`Sponsorship pool ${dto.poolId} not found`);
            if (pool.remaining_lkr < dto.estimatedCostLkr) {
                throw new BadRequestException(
                    `Insufficient pool balance: LKR ${pool.remaining_lkr.toLocaleString()} remaining, ` +
                    `LKR ${dto.estimatedCostLkr.toLocaleString()} required`,
                );
            }

            const { error: poolUpdateErr } = await this.supabase.adminClient
                .from('sponsorship_pools')
                .update({ remaining_lkr: pool.remaining_lkr - dto.estimatedCostLkr })
                .eq('id', dto.poolId);

            if (poolUpdateErr) {
                throw new InternalServerErrorException(`Failed to deduct pool balance: ${poolUpdateErr.message}`);
            }
        }

        const { data: grant, error: grantErr } = await this.supabase.adminClient
            .from('sponsored_grants')
            .insert({
                pool_id: dto.poolId ?? null,
                beneficiary_type: dto.beneficiaryType,
                beneficiary_id: dto.beneficiaryId,
                from_plan: dto.fromPlan,
                to_plan: dto.toPlan,
                expires_at: expiresAt.toISOString(),
                granted_by: caller.sub,
                estimated_cost_lkr: dto.estimatedCostLkr ?? 0,
                is_active: true,
                notes: dto.notes ?? null,
            })
            .select()
            .single();

        if (grantErr) throw new InternalServerErrorException(`Failed to award grant: ${grantErr.message}`);

        // Write GRANTED audit event
        const { error: eventErr } = await this.supabase.adminClient
            .from('sponsored_grant_events')
            .insert({
                grant_id: grant.id,
                event_type: GrantEventType.GRANTED,
                actor_id: caller.sub,
                metadata: { fromPlan: dto.fromPlan, toPlan: dto.toPlan, notes: dto.notes },
            });
        if (eventErr) {
            this.logger.error(`Failed to write GRANTED event: ${eventErr.message}`);
        }

        this.logger.log(`Grant awarded to ${dto.beneficiaryType}/${dto.beneficiaryId}: ${dto.fromPlan} → ${dto.toPlan}`);
        return grant;
    }

    async revokeGrant(grantId: string, dto: RevokeGrantDto, caller: JwtPayload): Promise<any> {
        this.guardSuperAdmin(caller);

        const { data: grant, error: fetchErr } = await this.supabase.adminClient
            .from('sponsored_grants')
            .select('*')
            .eq('id', grantId)
            .maybeSingle();

        if (fetchErr || !grant) throw new NotFoundException(`Grant ${grantId} not found`);
        if (!grant.is_active) throw new BadRequestException('Grant is already inactive');

        const { data, error } = await this.supabase.adminClient
            .from('sponsored_grants')
            .update({ is_active: false })
            .eq('id', grantId)
            .select()
            .single();

        if (error) throw new InternalServerErrorException(`Failed to revoke grant: ${error.message}`);

        // Restore pool remaining_lkr if applicable
        if (grant.pool_id && grant.estimated_cost_lkr > 0) {
            const { error: rpcErr } = await this.supabase.adminClient.rpc('increment_pool_remaining', {
                p_pool_id: grant.pool_id,
                p_amount: grant.estimated_cost_lkr,
            });
            if (rpcErr) {
                this.logger.warn(`Pool balance restore failed: ${rpcErr.message}`);
            }
        }

        // Write MANUAL_REVOKE audit event
        const { error: revokeEventErr } = await this.supabase.adminClient
            .from('sponsored_grant_events')
            .insert({
                grant_id: grantId,
                event_type: GrantEventType.MANUAL_REVOKE,
                actor_id: caller.sub,
                metadata: { reason: dto.reason ?? 'Manual revocation by Super Admin' },
            });
        if (revokeEventErr) {
            this.logger.error(`Failed to write MANUAL_REVOKE event: ${revokeEventErr.message}`);
        }

        this.logger.log(`Grant ${grantId} revoked by ${caller.sub}`);
        return data;
    }

    async listGrants(caller: JwtPayload, activeOnly = false): Promise<any[]> {
        this.guardSuperAdmin(caller);

        let query = this.supabase.adminClient
            .from('sponsored_grants')
            .select('*')
            .order('granted_at', { ascending: false });

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error) throw new InternalServerErrorException(`Failed to list grants: ${error.message}`);
        return data ?? [];
    }

    // ─── Automated Expiry Downgrade ────────────────────────────────────────────

    /**
     * Nightly job step: finds all grants where expires_at < NOW() and is_active = true,
     * marks them inactive, and writes EXPIRED audit events.
     * This is the automated "downgrade back to from_plan" step for expired grants.
     */
    async processExpiredGrants(): Promise<number> {
        const { data: expiredGrants, error: fetchErr } = await this.supabase.adminClient
            .from('sponsored_grants')
            .select('id, beneficiary_type, beneficiary_id, from_plan, pool_id, estimated_cost_lkr')
            .eq('is_active', true)
            .lt('expires_at', new Date().toISOString());

        if (fetchErr) {
            this.logger.error(`Failed to fetch expired grants: ${fetchErr.message}`);
            return 0;
        }

        if (!expiredGrants || expiredGrants.length === 0) return 0;

        const ids = expiredGrants.map((g: any) => g.id);

        const { error: deactivateErr } = await this.supabase.adminClient
            .from('sponsored_grants')
            .update({ is_active: false })
            .in('id', ids);

        if (deactivateErr) {
            this.logger.error(`Failed to deactivate expired grants: ${deactivateErr.message}`);
            return 0;
        }

        // Write EXPIRED events for each
        const events = ids.map((id: string) => ({
            grant_id: id,
            event_type: GrantEventType.EXPIRED,
            metadata: { processed_at: new Date().toISOString() },
        }));

        const { error: eventErr } = await this.supabase.adminClient
            .from('sponsored_grant_events')
            .insert(events);
        if (eventErr) {
            this.logger.error(`Failed to write EXPIRED events: ${eventErr.message}`);
        }

        this.logger.log(`Processed ${ids.length} expired sponsorship grants`);
        return ids.length;
    }
}
