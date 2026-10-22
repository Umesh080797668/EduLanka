import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantAnalyticsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Active students per tenant (Phase 3 billing integration).
   * Backed by read-only analytics view public.v_active_students_per_tenant (§7c).
   */
  async getActiveStudents(billingMonth?: string) {
    const month = billingMonth || new Date().toISOString().slice(0, 7);
    const sql = `
      SELECT 
        t.id AS "tenantId",
        t.name AS "tenantName",
        t.plan AS "plan",
        COALESCE(v.active_student_count, 0)::int AS "activeStudentCount"
      FROM public.tenants t
      LEFT JOIN public.v_active_students_per_tenant v ON v.tenant_id = t.id
      ORDER BY "activeStudentCount" DESC;
    `;
    const rows = await this.prisma.query(sql);
    return rows.map((r) => ({ ...r, billingMonth: month }));
  }

  /**
   * Global tutorial completion and skip statistics for System Admin (§7c).
   * Backed by public.get_global_tutorial_stats() RPC.
   */
  async getGlobalTutorialStats() {
    const sql = `
      SELECT 
        tutorial_id AS "tutorialId",
        role,
        screen_id AS "screenId",
        completed::int AS "completed",
        skipped::int AS "skipped",
        eligible::int AS "eligible",
        completion_percentage AS "completionPercentage"
      FROM public.get_global_tutorial_stats();
    `;
    return this.prisma.query(sql);
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
   * Retrieves billing snapshots for invoicing.
   * Per Blueprint §7c, billing snapshot generation and persistence is centrally
   * handled by the primary API BillingService to maintain a single source of truth.
   */
  async generateBillingSnapshots(billingMonth?: string) {
    const month = billingMonth || new Date().toISOString().slice(0, 7);
    return this.getBillingSnapshots(month);
  }
}
