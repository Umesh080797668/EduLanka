import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { calculateActiveStudentFee, BillingSnapshotRecord, UnpaidInvoicePolicyStatus } from './billing.types';

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly configService: ConfigService,
    ) { }

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

        // 1. Fetch all active tenants and their plan definitions
        const { data: tenants, error: tenantErr } = await admin
            .from('tenants')
            .select('id, name, plan, status')
            .eq('status', 'ACTIVE');

        if (tenantErr) {
            this.logger.error(`Failed to load active tenants: ${tenantErr.message}`);
            throw new Error(`Billing aggregation failed: ${tenantErr.message}`);
        }

        const { data: plans, error: planErr } = await admin
            .from('plans')
            .select('code, base_fee_lkr, price_per_student_lkr');

        if (planErr) {
            this.logger.error(`Failed to load plans: ${planErr.message}`);
            throw new Error(`Plan retrieval failed: ${planErr.message}`);
        }

        const planMap = new Map((plans ?? []).map((p: any) => [p.code, p]));

        // 2. Count active students per tenant in a single aggregation pass (§7c)
        const { data: studentCounts, error: studentErr } = await admin
            .from('students')
            .select('tenant_id')
            .eq('is_active', true);

        if (studentErr) {
            this.logger.error(`Failed to aggregate active students: ${studentErr.message}`);
            throw new Error(`Student aggregation failed: ${studentErr.message}`);
        }

        const countByTenant = new Map<string, number>();
        for (const s of studentCounts ?? []) {
            if (s.tenant_id) {
                countByTenant.set(s.tenant_id, (countByTenant.get(s.tenant_id) || 0) + 1);
            }
        }

        // 3. Count non-emergency SMS logs for the billing month
        const startOfMonth = `${month}-01T00:00:00.000Z`;
        const endOfMonth = new Date(
            parseInt(month.slice(0, 4), 10),
            parseInt(month.slice(5, 7), 10),
            1
        ).toISOString();

        const { data: smsLogs, error: smsErr } = await admin
            .from('sms_logs')
            .select('tenant_id, segment_count')
            .gte('created_at', startOfMonth)
            .lt('created_at', endOfMonth)
            .is('disaster_event_id', null);

        const smsCountByTenant = new Map<string, number>();
        if (!smsErr && smsLogs) {
            for (const log of smsLogs) {
                if (log.tenant_id) {
                    const segs = log.segment_count || 1;
                    smsCountByTenant.set(log.tenant_id, (smsCountByTenant.get(log.tenant_id) || 0) + segs);
                }
            }
        }

        // 4. Load configured SMS quotas
        const { data: quotas } = await admin
            .from('tenant_sms_quotas')
            .select('tenant_id, monthly_quota');
        const quotaMap = new Map((quotas ?? []).map((q: any) => [q.tenant_id, q.monthly_quota]));

        // 5. Load existing snapshots for this billing month to prevent overwriting non-DRAFT (ISSUED, PAID, OVERDUE) rows
        const { data: existingSnapshots } = await admin
            .from('billing_snapshots')
            .select('id, tenant_id, status')
            .eq('billing_month', month);
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
            const smsOverageCount = Math.max(0, smsTotal - allowance);
            const smsOverageCharge = smsOverageCount * overagePricePerSms;

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
                smsOverageCount,
                smsOverageChargeLkr: smsOverageCharge,
                totalAmountLkr,
                status: 'DRAFT',
            };

            const existing = existingMap.get(tenant.id);
            if (existing) {
                // NEVER overwrite finalized or invoiced rows (ISSUED, PAID, OVERDUE)
                if (existing.status !== 'DRAFT') {
                    this.logger.log(
                        `Skipping snapshot update for tenant ${tenant.id} (${month}): invoice is locked with status ${existing.status}.`,
                    );
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
     * Lists billing snapshots for a given month.
     */
    async getBillingSnapshots(billingMonth?: string) {
        const month = billingMonth || new Date().toISOString().slice(0, 7);
        const { data, error } = await this.supabase.adminClient
            .from('billing_snapshots')
            .select('*, tenants(name, slug)')
            .eq('billing_month', month)
            .order('total_amount_lkr', { ascending: false });

        if (error) {
            this.logger.error(`Failed to load billing snapshots: ${error.message}`);
            return [];
        }
        return data ?? [];
    }

    /**
     * Resolves the unpaid invoice policy (§7c open question settled):
     * A 14-day grace period is provided when an invoice enters OVERDUE status.
     * During the grace period, administrators retain full institutional access to view,
     * download data, and settle payment, while an alert banner is displayed across portals.
     * If invoices remain unpaid past the 14-day window, write operations are locked.
     */
    async checkTenantInvoiceStatus(tenantId: string): Promise<UnpaidInvoicePolicyStatus> {
        const admin = this.supabase.adminClient;
        const { data: overdueInvoices } = await admin
            .from('billing_snapshots')
            .select('*')
            .eq('tenant_id', tenantId)
            .in('status', ['OVERDUE', 'ISSUED'])
            .order('billing_month', { ascending: true });

        if (!overdueInvoices || overdueInvoices.length === 0) {
            return {
                tenantId,
                hasOverdueInvoices: false,
                inGracePeriod: false,
                isAccountLocked: false,
                graceDaysRemaining: 14,
                overdueAmountLkr: 0,
                message: 'Account is in good standing.',
            };
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

        return {
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
        this.logger.log(`Invoice ${id} issued for tenant ${existing.tenant_id} (Month: ${existing.billing_month})`);
        return data;
    }

    /**
     * Marks an invoice as PAID upon settlement confirmation.
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
        this.logger.log(`Invoice ${id} marked as PAID for tenant ${existing.tenant_id}`);
        return data;
    }

    /**
     * Nightly job step: transitions ISSUED invoices that have exceeded 14 days without payment to OVERDUE.
     */
    async processOverdueInvoices(): Promise<number> {
        const admin = this.supabase.adminClient;
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        const { data: overdueRows, error: fetchErr } = await admin
            .from('billing_snapshots')
            .select('id, tenant_id, total_amount_lkr')
            .eq('status', 'ISSUED')
            .lt('updated_at', fourteenDaysAgo);

        if (fetchErr || !overdueRows || overdueRows.length === 0) {
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
            return 0;
        }

        this.logger.warn(`Transitioned ${ids.length} issued invoices to OVERDUE status.`);
        return ids.length;
    }
}
