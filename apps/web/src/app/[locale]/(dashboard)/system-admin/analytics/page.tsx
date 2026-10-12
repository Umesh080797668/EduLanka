'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  RefreshCw,
  Users,
  MessageSquare,
  HardDrive,
  Smartphone,
  DownloadCloud,
  FileSpreadsheet,
  Building2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

import { analyticsFetch } from '@/lib/analytics-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ActiveStudentItem {
  tenantId: string;
  tenantName: string;
  plan: string;
  activeStudentCount: number;
  billingMonth: string;
}

interface SmsUsageItem {
  tenantId: string;
  tenantName: string;
  smsCount: number;
  lastSmsSentAt?: string;
}

interface StorageUsageItem {
  tenantId: string;
  tenantName: string;
  plan: string;
  storageQuotaGb: number;
  totalBytesUsed: number;
  totalGbUsed: number;
  isQuotaExceeded: boolean;
}

interface SyncHealthItem {
  tenantId: string;
  tenantName: string;
  totalDevices: number;
  staleDevices: number;
  latestActivityAt?: string;
}

interface MediaDownloadItem {
  subject: string;
  downloadCount: number;
  uniqueDownloadersCount: number;
  totalDownloadedBytes: number;
  distinctAssetsDownloaded: number;
}

interface BillingSnapshotItem {
  id: string;
  tenantId: string;
  tenantName: string;
  billingMonth: string;
  plan: string;
  activeStudentCount: number;
  baseFeeLkr: number;
  perStudentFeeLkr: number;
  smsCount: number;
  smsOverageChargeLkr: number;
  totalAmountLkr: number;
  status: string;
  createdAt: string;
}

export default function PlatformAnalyticsPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [activeStudents, setActiveStudents] = useState<ActiveStudentItem[]>([]);
  const [smsUsage, setSmsUsage] = useState<SmsUsageItem[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsageItem[]>([]);
  const [syncHealth, setSyncHealth] = useState<SyncHealthItem[]>([]);
  const [mediaDownloads, setMediaDownloads] = useState<MediaDownloadItem[]>([]);
  const [snapshots, setSnapshots] = useState<BillingSnapshotItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [generatingSnapshots, setGeneratingSnapshots] = useState(false);
  const [activeTab, setActiveTab] = useState<'students' | 'downloads' | 'sms' | 'sync' | 'billing'>('students');

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsRes, smsRes, storageRes, syncRes, mediaRes, snapshotsRes] = await Promise.allSettled([
        analyticsFetch<ActiveStudentItem[]>(`/tenants/active-students?billingMonth=${selectedMonth}`),
        analyticsFetch<SmsUsageItem[]>('/tenants/sms-usage'),
        analyticsFetch<StorageUsageItem[]>('/tenants/storage'),
        analyticsFetch<SyncHealthItem[]>('/sync-health?staleDays=3'),
        analyticsFetch<MediaDownloadItem[]>('/media/downloads'),
        analyticsFetch<BillingSnapshotItem[]>(`/billing/snapshots?billingMonth=${selectedMonth}`),
      ]);

      if (studentsRes.status === 'fulfilled') setActiveStudents(studentsRes.value || []);
      if (smsRes.status === 'fulfilled') setSmsUsage(smsRes.value || []);
      if (storageRes.status === 'fulfilled') setStorageUsage(storageRes.value || []);
      if (syncRes.status === 'fulfilled') setSyncHealth(syncRes.value || []);
      if (mediaRes.status === 'fulfilled') setMediaDownloads(mediaRes.value || []);
      if (snapshotsRes.status === 'fulfilled') setSnapshots(snapshotsRes.value || []);
    } catch (err: any) {
      toast.error('Failed to load platform analytics', {
        description: err?.message || 'Check microservice connection and credentials',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleGenerateSnapshots = async () => {
    setGeneratingSnapshots(true);
    try {
      const res = await analyticsFetch<BillingSnapshotItem[]>('/billing/snapshots/generate', {
        method: 'POST',
        body: JSON.stringify({ billingMonth: selectedMonth }),
      });
      setSnapshots(res || []);
      toast.success(`Billing snapshots generated for ${selectedMonth}`);
    } catch (err: any) {
      toast.error('Snapshot generation failed', {
        description: err?.message,
      });
    } finally {
      setGeneratingSnapshots(false);
    }
  };

  const totalStudents = activeStudents.reduce((acc, curr) => acc + (curr.activeStudentCount || 0), 0);
  const totalSms = smsUsage.reduce((acc, curr) => acc + (curr.smsCount || 0), 0);
  const totalStorageGb = storageUsage.reduce((acc, curr) => acc + (curr.totalGbUsed || 0), 0);
  const totalDownloads = mediaDownloads.reduce((acc, curr) => acc + (curr.downloadCount || 0), 0);
  const totalStaleDevices = syncHealth.reduce((acc, curr) => acc + (curr.staleDevices || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            Platform Analytics & Telemetry
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregated cross-tenant metrics, billing snapshots, and sync health telemetry (Phase 3).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
            <Calendar className="size-4 text-muted-foreground" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-foreground text-sm focus:outline-none"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across {activeStudents.length} institutions</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">SMS Dispatched</CardTitle>
            <MessageSquare className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSms.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Platform alert notifications</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Storage Used</CardTitle>
            <HardDrive className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStorageGb.toFixed(2)} GB</div>
            <p className="text-xs text-muted-foreground mt-1">Video & document payloads</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Media Downloads</CardTitle>
            <DownloadCloud className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDownloads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Offline video packages</p>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stale Devices</CardTitle>
            <Smartphone className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">{totalStaleDevices.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Sync lag &gt; 3 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border space-x-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 transition-colors ${activeTab === 'students'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Active Students ({activeStudents.length})
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-3 transition-colors ${activeTab === 'billing'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Billing Snapshots ({snapshots.length})
        </button>
        <button
          onClick={() => setActiveTab('downloads')}
          className={`pb-3 transition-colors ${activeTab === 'downloads'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Media Downloads ({mediaDownloads.length})
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`pb-3 transition-colors ${activeTab === 'sms'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          SMS Usage ({smsUsage.length})
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`pb-3 transition-colors ${activeTab === 'sync'
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          Device Sync Lag ({syncHealth.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'students' && (
        <Card>
          <CardHeader>
            <CardTitle>Active Student Enrollment per Institution</CardTitle>
            <CardDescription>
              Determines metered per-student billing tiers for month {selectedMonth}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3">School Name</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3 text-right">Active Students</th>
                    <th className="py-2.5 px-3">Billing Month</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeStudents.map((item) => (
                    <tr key={item.tenantId} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                        <Building2 className="size-4 text-muted-foreground" />
                        {item.tenantName}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline">{item.plan}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold">
                        {item.activeStudentCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{item.billingMonth}</td>
                    </tr>
                  ))}
                  {activeStudents.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No student telemetry data recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'billing' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Tenant Billing Snapshots ({selectedMonth})</CardTitle>
              <CardDescription>
                Calculated monthly base fee, student fee, and SMS overage charges.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleGenerateSnapshots}
              disabled={generatingSnapshots}
              className="gap-2"
            >
              <FileSpreadsheet className="size-4" />
              {generatingSnapshots ? 'Generating...' : 'Compute Snapshots'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3">School</th>
                    <th className="py-2.5 px-3">Tier</th>
                    <th className="py-2.5 px-3 text-right">Students</th>
                    <th className="py-2.5 px-3 text-right">Base (LKR)</th>
                    <th className="py-2.5 px-3 text-right">SMS Overage</th>
                    <th className="py-2.5 px-3 text-right">Total Charge</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {snapshots.map((s) => (
                    <tr key={s.id || s.tenantId} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{s.tenantName}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline">{s.plan}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">{s.activeStudentCount}</td>
                      <td className="py-2.5 px-3 text-right">{s.baseFeeLkr.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {s.smsOverageChargeLkr.toLocaleString()} LKR
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-primary">
                        {s.totalAmountLkr.toLocaleString()} LKR
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge tone={s.status === 'PAID' ? 'success' : 'neutral'} variant="soft">
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {snapshots.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No billing snapshot exists for {selectedMonth}. Click "Compute Snapshots" to calculate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'downloads' && (
        <Card>
          <CardHeader>
            <CardTitle>Offline Media Downloads & Video Distribution</CardTitle>
            <CardDescription>
              Telemetry logged whenever Growth or Institutional tenants issue encrypted download manifests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3 text-right">Download Count</th>
                    <th className="py-2.5 px-3 text-right">Unique Students</th>
                    <th className="py-2.5 px-3 text-right">Volume (MB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mediaDownloads.map((m, idx) => (
                    <tr key={m.subject || idx} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{m.subject || 'General Resources'}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{m.downloadCount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">{m.uniqueDownloadersCount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        {(Number(m.totalDownloadedBytes) / (1024 * 1024)).toFixed(1)} MB
                      </td>
                    </tr>
                  ))}
                  {mediaDownloads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted-foreground">
                        No media downloads logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'sms' && (
        <Card>
          <CardHeader>
            <CardTitle>SMS Gateway Volume & Last Sent Timestamp</CardTitle>
            <CardDescription>Emergency and disaster broadcast messages sent per tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3">School Name</th>
                    <th className="py-2.5 px-3 text-right">SMS Sent</th>
                    <th className="py-2.5 px-3">Last Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {smsUsage.map((s) => (
                    <tr key={s.tenantId} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{s.tenantName}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{s.smsCount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {s.lastSmsSentAt ? new Date(s.lastSmsSentAt).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'sync' && (
        <Card>
          <CardHeader>
            <CardTitle>Mobile Device Sync Telemetry & Stale Nodes</CardTitle>
            <CardDescription>
              Monitors devices with un-synchronized local Drift/SQLCipher databases older than 3 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2.5 px-3">School</th>
                    <th className="py-2.5 px-3 text-right">Total Active Devices</th>
                    <th className="py-2.5 px-3 text-right">Stale (&gt;3d)</th>
                    <th className="py-2.5 px-3">Latest Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {syncHealth.map((d) => (
                    <tr key={d.tenantId} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium">{d.tenantName}</td>
                      <td className="py-2.5 px-3 text-right">{d.totalDevices}</td>
                      <td className="py-2.5 px-3 text-right">
                        {d.staleDevices > 0 ? (
                          <Badge tone="danger" variant="soft">
                            {d.staleDevices} stale
                          </Badge>
                        ) : (
                          <Badge tone="success" variant="outline">
                            Healthy
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {d.latestActivityAt ? new Date(d.latestActivityAt).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
