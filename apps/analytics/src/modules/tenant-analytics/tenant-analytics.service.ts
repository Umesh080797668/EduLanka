import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantAnalyticsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Active students per tenant (Phase 3 billing integration).
   */
  async getActiveStudents(billingMonth?: string) {
    const month = billingMonth || new Date().toISOString().slice(0, 7);
    const sql = `
      SELECT 
        t.id AS "tenantId",
        t.name AS "tenantName",
        t.plan AS "plan",
        COUNT(u.id)::int AS "activeStudentCount"
      FROM public.tenants t
      LEFT JOIN public.users u ON u.tenant_id = t.id AND u.role = 'STUDENT' AND u.is_active = true
      GROUP BY t.id, t.name, t.plan
      ORDER BY "activeStudentCount" DESC;
    `;
    const rows = await this.prisma.query(sql);
    return rows.map((r) => ({ ...r, billingMonth: month }));
  }

  /**
   * SMS blast usage per tenant.
   */
  async getSmsUsage() {
    const sql = `
      SELECT 
        t.id AS "tenantId",
        t.name AS "tenantName",
        COUNT(s.id)::int AS "smsCount",
        MAX(s.created_at) AS "lastSmsSentAt"
      FROM public.tenants t
      LEFT JOIN public.sms_logs s ON s.tenant_id = t.id
      GROUP BY t.id, t.name
      ORDER BY "smsCount" DESC;
    `;
    try {
      return await this.prisma.query(sql);
    } catch {
      return [];
    }
  }

  /**
   * Storage consumed vs plan quota.
   */
  async getStorageUsage() {
    const sql = `
      SELECT 
        tenant_id AS "tenantId",
        tenant_name AS "tenantName",
        plan,
        storage_quota_gb::float AS "storageQuotaGb",
        total_bytes_used::bigint AS "totalBytesUsed",
        total_gb_used::float AS "totalGbUsed",
        is_quota_exceeded AS "isQuotaExceeded"
      FROM public.tenant_storage_usage
      ORDER BY total_bytes_used DESC;
    `;
    return this.prisma.query(sql);
  }

  /**
   * Mobile device sync health and lag across tenants.
   */
  async getSyncHealth(staleDays = 3) {
    const sql = `
      SELECT 
        d.tenant_id AS "tenantId",
        t.name AS "tenantName",
        COUNT(d.id)::int AS "totalDevices",
        COUNT(CASE WHEN d.last_seen_at < NOW() - INTERVAL '1 day' * $1 THEN 1 END)::int AS "staleDevices",
        MAX(d.last_seen_at) AS "latestActivityAt"
      FROM public.device_tokens d
      LEFT JOIN public.tenants t ON t.id = d.tenant_id
      WHERE d.is_active = true
      GROUP BY d.tenant_id, t.name;
    `;
    return this.prisma.query(sql, [staleDays]);
  }

  /**
   * Media asset download and distribution statistics from actual download logs.
   */
  async getMediaDownloads() {
    const downloadLogsSql = `
      SELECT 
        m.subject,
        COUNT(l.id)::int AS "downloadCount",
        COUNT(DISTINCT l.user_id)::int AS "uniqueDownloadersCount",
        COALESCE(SUM(l.file_size_bytes), 0)::bigint AS "totalDownloadedBytes",
        COUNT(DISTINCT m.id)::int AS "distinctAssetsDownloaded"
      FROM public.media_download_logs l
      JOIN public.media_assets m ON m.id = l.asset_id
      GROUP BY m.subject
      ORDER BY "downloadCount" DESC;
    `;

    try {
      const records = await this.prisma.query(downloadLogsSql);
      if (records && records.length > 0) {
        return records;
      }
    } catch {
      // Table may be newly migrated
    }

    // Fallback: If no downloads recorded yet, present downloadable media catalog breakdown
    const catalogSql = `
      SELECT 
        m.subject,
        0::int AS "downloadCount",
        0::int AS "uniqueDownloadersCount",
        0::bigint AS "totalDownloadedBytes",
        COUNT(m.id)::int AS "distinctAssetsDownloaded",
        COUNT(CASE WHEN m.is_downloadable = true THEN 1 END)::int AS "downloadableCount"
      FROM public.media_assets m
      WHERE m.status = 'ready'
      GROUP BY m.subject
      ORDER BY "distinctAssetsDownloaded" DESC;
    `;
    return this.prisma.query(catalogSql);
  }

  /**
   * Retrieves billing snapshots for invoicing.
   */
  async getBillingSnapshots(billingMonth?: string) {
    const month = billingMonth || new Date().toISOString().slice(0, 7);
    const sql = `
      SELECT 
        b.id,
        b.tenant_id AS "tenantId",
        t.name AS "tenantName",
        b.billing_month AS "billingMonth",
        b.plan,
        b.active_student_count AS "activeStudentCount",
        b.base_fee_lkr AS "baseFeeLkr",
        b.per_student_fee_lkr AS "perStudentFeeLkr",
        b.sms_count AS "smsCount",
        b.sms_overage_charge_lkr AS "smsOverageChargeLkr",
        b.total_amount_lkr AS "totalAmountLkr",
        b.status,
        b.created_at AS "createdAt"
      FROM public.billing_snapshots b
      JOIN public.tenants t ON t.id = b.tenant_id
      WHERE b.billing_month = $1
      ORDER BY b.total_amount_lkr DESC;
    `;
    try {
      return await this.prisma.query(sql, [month]);
    } catch {
      return [];
    }
  }

  /**
   * Computes and writes billing snapshots for all tenants for the specified month.
   */
  async generateBillingSnapshots(billingMonth?: string) {
    const month = billingMonth || new Date().toISOString().slice(0, 7);

    // Dynamic per-student SMS quota calculation matching blueprint and tenant_sms_quotas:
    // Community: 0, Starter: 3/student (min 100), Growth: 5/student (min 500), Institutional: 8/student (min 2000)
    // Emergency broadcast SMS (disaster_event_id IS NOT NULL) are explicitly excluded from billing.
    const computeSql = `
      SELECT 
        t.id AS "tenantId",
        t.plan AS "plan",
        COALESCE(p.base_fee_lkr, 0)::int AS "baseFeeLkr",
        COALESCE(p.price_per_student_lkr, 0)::int AS "pricePerStudentLkr",
        COUNT(DISTINCT u.id)::int AS "activeStudentCount",
        COUNT(DISTINCT s.id)::int AS "smsCount",
        COALESCE(q.monthly_quota, 
          CASE 
            WHEN t.plan = 'STARTER' THEN GREATEST(COUNT(DISTINCT u.id)::int * 3, 100)
            WHEN t.plan = 'GROWTH' THEN GREATEST(COUNT(DISTINCT u.id)::int * 5, 500)
            WHEN t.plan = 'INSTITUTIONAL' THEN GREATEST(COUNT(DISTINCT u.id)::int * 8, 2000)
            ELSE 0 
          END
        )::int AS "smsAllowance"
      FROM public.tenants t
      LEFT JOIN public.plans p ON p.code = t.plan
      LEFT JOIN public.users u ON u.tenant_id = t.id AND u.role = 'STUDENT' AND u.is_active = true
      LEFT JOIN public.sms_logs s ON s.tenant_id = t.id AND TO_CHAR(s.created_at, 'YYYY-MM') = $1 AND s.disaster_event_id IS NULL
      LEFT JOIN public.tenant_sms_quotas q ON q.tenant_id = t.id
      WHERE t.status = 'ACTIVE'
      GROUP BY t.id, t.plan, p.base_fee_lkr, p.price_per_student_lkr, q.monthly_quota;
    `;

    const tenantData = await this.prisma.query(computeSql, [month]);
    const overagePricePerSms = Number(process.env.SMS_OVERAGE_PRICE_LKR) || 2;

    for (const td of tenantData) {
      // Blueprint §7b: Volume discount applies to Active Student Fee component only
      let studentDiscount = 0;
      if (td.activeStudentCount > 1000) {
        studentDiscount = 0.20;
      } else if (td.activeStudentCount > 250) {
        studentDiscount = 0.10;
      }
      const effectiveStudentRate = td.pricePerStudentLkr * (1 - studentDiscount);
      const studentCharge = Math.round(td.activeStudentCount * effectiveStudentRate);
      const allowance = td.smsAllowance !== undefined ? Number(td.smsAllowance) : (
        td.plan === 'STARTER' ? Math.max(td.activeStudentCount * 3, 100) :
          td.plan === 'GROWTH' ? Math.max(td.activeStudentCount * 5, 500) :
            td.plan === 'INSTITUTIONAL' ? Math.max(td.activeStudentCount * 8, 2000) : 0
      );
      const smsOverageCount = Math.max(0, td.smsCount - allowance);
      const smsOverageCharge = smsOverageCount * overagePricePerSms;
      const totalAmount = td.baseFeeLkr + studentCharge + smsOverageCharge;

      // Safe Upsert: Only modify DRAFT snapshots; never overwrite finalized ISSUED or PAID invoices
      const upsertSql = `
        INSERT INTO public.billing_snapshots (
          tenant_id, billing_month, plan, active_student_count, base_fee_lkr,
          per_student_fee_lkr, sms_count, sms_overage_charge_lkr, total_amount_lkr, status, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DRAFT', NOW())
        ON CONFLICT (tenant_id, billing_month)
        DO UPDATE SET
          plan = EXCLUDED.plan,
          active_student_count = EXCLUDED.active_student_count,
          base_fee_lkr = EXCLUDED.base_fee_lkr,
          per_student_fee_lkr = EXCLUDED.per_student_fee_lkr,
          sms_count = EXCLUDED.sms_count,
          sms_overage_charge_lkr = EXCLUDED.sms_overage_charge_lkr,
          total_amount_lkr = EXCLUDED.total_amount_lkr,
          updated_at = NOW()
        WHERE public.billing_snapshots.status = 'DRAFT';
      `;

      const executeWrite = this.prisma.writeQuery ? this.prisma.writeQuery.bind(this.prisma) : this.prisma.query.bind(this.prisma);
      await executeWrite(upsertSql, [
        td.tenantId,
        month,
        td.plan || 'COMMUNITY',
        td.activeStudentCount,
        td.baseFeeLkr,
        td.pricePerStudentLkr,
        td.smsCount,
        smsOverageCharge,
        totalAmount,
      ]);
    }

    return this.getBillingSnapshots(month);
  }
}
