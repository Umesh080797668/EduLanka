import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

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
        COUNT(u.id)::int AS "activeStudentCount",
        $1 AS "billingMonth"
      FROM public.tenants t
      LEFT JOIN public.users u ON u.tenant_id = t.id AND u.role = 'STUDENT' AND u.status = 'ACTIVE'
      GROUP BY t.id, t.name, t.plan
      ORDER BY "activeStudentCount" DESC;
    `;
    return this.prisma.query(sql, [month]);
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
   * Media asset download and distribution statistics.
   */
  async getMediaDownloads() {
    const sql = `
      SELECT 
        m.subject,
        COUNT(m.id)::int AS "assetCount",
        SUM(m.file_size_bytes)::bigint AS "totalSizeBytes",
        COUNT(CASE WHEN m.is_downloadable = true THEN 1 END)::int AS "downloadableCount"
      FROM public.media_assets m
      WHERE m.status = 'ready'
      GROUP BY m.subject
      ORDER BY "assetCount" DESC;
    `;
    return this.prisma.query(sql);
  }
}
