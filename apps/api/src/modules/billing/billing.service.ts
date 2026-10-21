import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { calculateActiveStudentFee, BillingSnapshotRecord, UnpaidInvoicePolicyStatus } from './billing.types';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    /** In-memory cache for tenant lock status to eliminate 1 DB query per write request (§7c) */
    private readonly lockStatusCache = new Map<string, { status: UnpaidInvoicePolicyStatus; expiresAt: number }>();
    private readonly LOCK_CACHE_TTL_MS = 60_000; // 60-second TTL

    constructor(
        private readonly supabase: SupabaseService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Clears cached invoice status for a single tenant (e.g. after payment) or all tenants.
     */
    clearTenantLockCache(tenantId?: string) {
        if (tenantId) {
            this.lockStatusCache.delete(tenantId);
        } else {
            this.lockStatusCache.clear();
        }
    }

    /**
     * Paginates across PostgREST queries exceeding the default 1,000-row limit.
     */
    private async fetchAllRows<T = any>(
        queryFn: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
    ): Promise<T[]> {
        const PAGE_SIZE = 1000;
        let from = 0;
        const all: T[] = [];
        while (true) {
            const res = await queryFn(from, from + PAGE_SIZE - 1);
            const { data, error } = res || {};
            if (error) {
                this.logger.error(`Error fetching page ${from}-${from + PAGE_SIZE - 1}: ${error.message}`);
                throw error;
            }
            if (!data || data.length === 0) break;
            all.push(...data);
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }
        return all;
    }

    /**
     * Nightly billing job running per Blueprint Section 7c.
     * Computes active student count across all tenants in a single shared-schema pass,
     * applies the volume discount schedule to the variable student fee,
     * cross-checks Twilio SMS usage beyond the bundled allowance,
     * and writes the computed snapshot to public.billing_snapshots.
     */
    async generateBillingSnapshots(billingMonth?: string): Promise<BillingSnapshotRecord[]> {
        const month = billingMonth || new Date().toISOString().slice(0, 7);
        this.logger.log(`Executing billing snapshot generation for month: ${month}`);

        const admin = this.supabase.adminClient;

        // 1. Fetch all active tenants and their plan definitions, handling >1,000 rows
        const tenants = await this.fetchAllRows(async (from, to) => {
            const q = admin
                .from('tenants')
                .select('id, name, plan, status')
                .eq('status', 'ACTIVE');
            return typeof q.range === 'function' ? q.range(from, to) : q;
        });

        const { data: plans, error: planErr } = await admin
            .from('plans')
            .select('code, base_fee_lkr, price_per_student_lkr');

        if (planErr) {
            this.logger.error(`Failed to load plans: ${planErr.message}`);
            throw new Error(`Plan retrieval failed: ${planErr.message}`);
        }

        const planMap = new Map((plans ?? []).map((p: any) => [p.code, p]));

        // 2. Count active students per tenant in a single aggregation pass (§7c).
        // Uses the database view public.v_active_students_per_tenant (with RPC fallback)
        // to pre-aggregate counts in Postgres, strictly checking users.is_active = true and
        // avoiding PostgREST's 1,000-row pagination limit.
        const countByTenant = new Map<string, number>();
        const { data: studentCounts, error: studentErr } = await admin
            .from('v_active_students_per_tenant')
            .select('tenant_id, active_student_count');

        if (studentErr) {
            this.logger.warn(`v_active_students_per_tenant view query failed, attempting RPC fallback: ${studentErr.message}`);
            const { data: rpcCounts, error: rpcErr } = await admin
                .rpc('get_active_student_counts_per_tenant');

            if (rpcErr) {
                this.logger.error(`Failed to aggregate active students: ${rpcErr.message}`);
                throw new Error(`Student aggregation failed: ${rpcErr.message}`);
            }

            for (const s of (rpcCounts ?? []) as any[]) {
                if (s.tenant_id) {
                    countByTenant.set(s.tenant_id, Number(s.active_student_count) || 0);
                }
            }
        } else {
            for (const s of (studentCounts ?? []) as any[]) {
                if (s.tenant_id) {
                    countByTenant.set(s.tenant_id, Number(s.active_student_count) || 0);
                }
            }
        }

        // 3. Count non-emergency SMS logs for the billing month, handling >1,000 rows
        const startOfMonth = `${month}-01T00:00:00.000Z`;
        const endOfMonth = new Date(
            parseInt(month.slice(0, 4), 10),
            parseInt(month.slice(5, 7), 10),
            1
        ).toISOString();

        const smsLogs = await this.fetchAllRows(async (from, to) => {
            const q = admin
                .from('sms_logs')
                .select('tenant_id, segment_count')
                .gte('created_at', startOfMonth)
                .lt('created_at', endOfMonth)
                .is('disaster_event_id', null);
            return typeof q.range === 'function' ? q.range(from, to) : q;
        });

        const smsCountByTenant = new Map<string, number>();
        for (const log of smsLogs ?? []) {
            if (log.tenant_id) {
                const segs = log.segment_count || 1;
                smsCountByTenant.set(log.tenant_id, (smsCountByTenant.get(log.tenant_id) || 0) + segs);
            }
        }

        // 4. Load configured SMS quotas
        const quotas = await this.fetchAllRows(async (from, to) => {
            const q = admin
                .from('tenant_sms_quotas')
                .select('tenant_id, monthly_quota');
            return typeof q.range === 'function' ? q.range(from, to) : q;
        });
        const quotaMap = new Map((quotas ?? []).map((q: any) => [q.tenant_id, q.monthly_quota]));

        // 5. Load existing snapshots for this billing month, handling >1,000 rows
        const existingSnapshots = await this.fetchAllRows(async (from, to) => {
            const q = admin
                .from('billing_snapshots')
                .select('id, tenant_id, status')
                .eq('billing_month', month);
            return typeof q.range === 'function' ? q.range(from, to) : q;
        });
        const existingMap = new Map((existingSnapshots ?? []).map((s: any) => [s.tenant_id, s]));

        const overagePricePerSms = this.configService.get<number>('SMS_OVERAGE_PRICE_LKR') ?? 2;
        const results: BillingSnapshotRecord[] = [];

        for (const tenant of tenants ?? []) {
            const planCode = tenant.plan || 'COMMUNITY';
            const planDef = planMap.get(planCode) || { base_fee_lkr: 0, price_per_student_lkr: 0 };
            const baseFeeLkr = planDef.base_fee_lkr || 0;
            const pricePerStudentLkr = planDef.price_per_student_lkr || 0;

            const activeStudents = countByTenant.get(tenant.id) || 0;

            // Blueprint §7b: Volume discounts apply to the Active Student Fee component only
            const studentFeeCalc = calculateActiveStudentFee(activeStudents, pricePerStudentLkr);

            // Compute SMS bundle allowance
            const customQuota = quotaMap.get(tenant.id);
            const allowance = customQuota !== undefined ? customQuota : (
                planCode === 'STARTER' ? Math.max(activeStudents * 3, 100) :
                    planCode === 'GROWTH' ? Math.max(activeStudents * 5, 500) :
                        planCode === 'INSTITUTIONAL' ? Math.max(activeStudents * 8, 2000) : 0
            );

            const smsTotal = smsCountByTenant.get(tenant.id) || 0;
            const smsOverage = Math.max(0, smsTotal - allowance);
            const smsOverageCharge = smsOverage * overagePricePerSms;

            const totalAmountLkr = baseFeeLkr + studentFeeCalc.totalStudentFeeLkr + smsOverageCharge;

            const snapshot: BillingSnapshotRecord = {
                tenantId: tenant.id,
                billingMonth: month,
                plan: planCode,
                activeStudentCount: activeStudents,
                baseFeeLkr,
                perStudentFeeLkr: pricePerStudentLkr,
                smsCount: smsTotal,
                smsAllowance: allowance,
                smsOverageCount: smsOverage,
                smsOverageChargeLkr: smsOverageCharge,
                totalAmountLkr,
                status: 'DRAFT',
            };

            const existing = existingMap.get(tenant.id);

            if (existing) {
                // If invoice is already finalized (ISSUED, PAID, OVERDUE), do not overwrite!
                if (existing.status !== 'DRAFT') {
                    this.logger.log(`Skipping tenant ${tenant.id}: invoice for ${month} is already ${existing.status}`);
                    results.push({ ...snapshot, id: existing.id, status: existing.status });
                    continue;
                }

                // Update only DRAFT snapshot
                const { error: updateErr } = await admin
                    .from('billing_snapshots')
                    .update({
                        plan: planCode,
                        active_student_count: activeStudents,
                        base_fee_lkr: baseFeeLkr,
                        per_student_fee_lkr: pricePerStudentLkr,
                        sms_count: smsTotal,
                        sms_overage_charge_lkr: smsOverageCharge,
                        total_amount_lkr: totalAmountLkr,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id)
                    .eq('status', 'DRAFT');

                if (updateErr) {
                    this.logger.warn(`Failed to update DRAFT snapshot for tenant ${tenant.id}: ${updateErr.message}`);
                } else {
                    results.push({ ...snapshot, id: existing.id });
                }
            } else {
                // Insert new DRAFT snapshot
                const { data: inserted, error: insertErr } = await admin
                    .from('billing_snapshots')
                    .insert({
                        tenant_id: tenant.id,
                        billing_month: month,
                        plan: planCode,
                        active_student_count: activeStudents,
                        base_fee_lkr: baseFeeLkr,
                        per_student_fee_lkr: pricePerStudentLkr,
                        sms_count: smsTotal,
                        sms_overage_charge_lkr: smsOverageCharge,
                        total_amount_lkr: totalAmountLkr,
                        status: 'DRAFT',
                        updated_at: new Date().toISOString(),
                    })
                    .select('id')
                    .maybeSingle();

                if (insertErr) {
                    this.logger.warn(`Failed to insert snapshot for tenant ${tenant.id}: ${insertErr.message}`);
                } else {
                    results.push({ ...snapshot, id: inserted?.id });
                }
            }
        }

        this.logger.log(`Generated ${results.length} billing snapshots for month ${month}`);
        return results;
    }

    /**
     * Lists billing snapshots for a given month, handling pagination beyond 1,000 rows.
     */
    async getBillingSnapshots(billingMonth?: string) {
        const month = billingMonth || new Date().toISOString().slice(0, 7);
        try {
            return await this.fetchAllRows(async (from, to) => {
                const q = this.supabase.adminClient
                    .from('billing_snapshots')
                    .select('*, tenants(name, slug)')
                    .eq('billing_month', month)
                    .order('total_amount_lkr', { ascending: false });
                return typeof q.range === 'function' ? q.range(from, to) : q;
            });
        } catch (error: any) {
            this.logger.error(`Failed to load billing snapshots: ${error.message}`);
            return [];
        }
    }

    /**
     * Resolves the unpaid invoice policy (§7c open question settled):
     * A 14-day grace period is provided when an invoice enters OVERDUE status.
     * During the grace period, administrators retain full institutional access to view,
     * download data, and settle payment, while an alert banner is displayed across portals.
     * If invoices remain unpaid past the 14-day window, write operations are locked.
     * Cached for 60 seconds to eliminate redundant database queries on repeated write operations.
     */
    async checkTenantInvoiceStatus(tenantId: string): Promise<UnpaidInvoicePolicyStatus> {
        const cached = this.lockStatusCache.get(tenantId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.status;
        }

        const admin = this.supabase.adminClient;
        const { data: overdueInvoices } = await admin
            .from('billing_snapshots')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('status', ['OVERDUE', 'ISSUED'])
            .order('billing_month', { ascending: true });

        if (!overdueInvoices || overdueInvoices.length === 0) {
            const status: UnpaidInvoicePolicyStatus = {
                tenantId,
                hasOverdueInvoices: false,
                inGracePeriod: false,
                isAccountLocked: false,
                graceDaysRemaining: 14,
                overdueAmountLkr: 0,
                message: 'Account is in good standing.',
            };
            this.lockStatusCache.set(tenantId, { status, expiresAt: Date.now() + this.LOCK_CACHE_TTL_MS });
            return status;
        }

        const now = Date.now();
        const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
        let totalOverdue = 0;
        let oldestInvoiceCreated = Infinity;

        for (const inv of overdueInvoices) {
            totalOverdue += inv.total_amount_lkr || 0;
            const invTime = new Date(inv.created_at || inv.updated_at).getTime();
            if (invTime < oldestInvoiceCreated) oldestInvoiceCreated = invTime;
        }

        const elapsed = now - oldestInvoiceCreated;
        const inGracePeriod = elapsed <= GRACE_PERIOD_MS;
        const graceDaysRemaining = Math.max(0, Math.ceil((GRACE_PERIOD_MS - elapsed) / (24 * 60 * 60 * 1000)));

        const status: UnpaidInvoicePolicyStatus = {
            tenantId,
            hasOverdueInvoices: true,
            inGracePeriod,
            isAccountLocked: !inGracePeriod,
            graceDaysRemaining,
            overdueAmountLkr: totalOverdue,
            message: inGracePeriod
                ? `Account has pending invoices in 14-day grace period (${graceDaysRemaining} days remaining). Please settle balance of LKR ${totalOverdue.toLocaleString()}.`
                : `Account is locked due to overdue invoice past the 14-day grace period. Please contact administration.`,
        };

        this.lockStatusCache.set(tenantId, { status, expiresAt: Date.now() + this.LOCK_CACHE_TTL_MS });
        return status;
    }

    /**
     * Issues a DRAFT invoice, making it finalized and official (DRAFT -> ISSUED).
     */
    async issueInvoice(id: string) {
        const admin = this.supabase.adminClient;
        const { data: existing, error: fetchErr } = await admin
            .from('billing_snapshots')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr || !existing) {
            throw new NotFoundException(`Invoice ${id} not found`);
        }

        if (existing.status !== 'DRAFT') {
            throw new BadRequestException(`Only DRAFT invoices can be issued. Current status: ${existing.status}`);
        }

        const { data, error } = await admin
            .from('billing_snapshots')
            .update({
                status: 'ISSUED',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('status', 'DRAFT')
            .select()
            .single();

        if (error) {
            throw new InternalServerErrorException(`Failed to issue invoice: ${error.message}`);
        }
        this.clearTenantLockCache(existing.tenant_id);
        this.logger.log(`Invoice ${id} issued for tenant ${existing.tenant_id} (Month: ${existing.billing_month})`);
        return data;
    }

    /**
     * Marks an invoice as PAID upon settlement confirmation.
     * Rejects DRAFT invoices — only ISSUED or OVERDUE invoices can be paid.
     */
    async markInvoicePaid(id: string) {
        const admin = this.supabase.adminClient;
        const { data: existing, error: fetchErr } = await admin
            .from('billing_snapshots')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchErr || !existing) {
            throw new NotFoundException(`Invoice ${id} not found`);
        }

        if (existing.status === 'PAID') {
            return existing;
        }

        if (existing.status === 'DRAFT') {
            throw new BadRequestException(
                'Cannot mark a DRAFT invoice as paid. Invoices must be ISSUED before being marked as PAID.',
            );
        }

        const { data, error } = await admin
            .from('billing_snapshots')
            .update({
                status: 'PAID',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new InternalServerErrorException(`Failed to mark invoice as paid: ${error.message}`);
        }
        this.clearTenantLockCache(existing.tenant_id);
        this.logger.log(`Invoice ${id} marked as PAID for tenant ${existing.tenant_id}`);
        return data;
    }

    /**
     * Nightly job step: transitions ISSUED invoices that have exceeded 14 days without payment to OVERDUE.
     */
    async processOverdueInvoices(): Promise<number> {
        const admin = this.supabase.adminClient;
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        const overdueRows = await this.fetchAllRows(async (from, to) => {
            const q = admin
                .from('billing_snapshots')
                .select('id, tenant_id, total_amount_lkr')
                .eq('status', 'ISSUED')
                .lt('updated_at', fourteenDaysAgo);
            return typeof q.range === 'function' ? q.range(from, to) : q;
        });

        if (!overdueRows || overdueRows.length === 0) {
            return 0;
        }

        const ids = overdueRows.map((r: any) => r.id);
        const { error: updateErr } = await admin
            .from('billing_snapshots')
            .update({
                status: 'OVERDUE',
                updated_at: new Date().toISOString(),
            })
            .in('id', ids);

        if (updateErr) {
            this.logger.error(`Failed to transition overdue invoices: ${updateErr.message}`);
            throw new InternalServerErrorException('Failed to process overdue invoices');
        }

        this.clearTenantLockCache();
        this.logger.log(`Transitioned ${ids.length} invoices to OVERDUE status`);
        return ids.length;
    }
}
