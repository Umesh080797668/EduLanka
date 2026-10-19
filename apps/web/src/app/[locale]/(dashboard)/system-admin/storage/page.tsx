'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    AlertTriangle,
    Database,
    HardDrive,
    RefreshCw,
    Search,
    TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface TenantStorageItem {
    tenant_id: string;
    tenant_name: string;
    plan: string;
    storage_quota_gb: number;
    total_bytes_used: number;
    total_gb_used: number;
    is_quota_exceeded: boolean;
}

export default function StorageMonitoringPage() {
    const [tenants, setTenants] = useState<TenantStorageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchStorageData = useCallback(async () => {
        try {
            const res = await apiClient.get<{ success: boolean; tenants: TenantStorageItem[] }>(
                '/media/storage-usage',
            );
            setTenants(res.tenants || []);
        } catch (err: any) {
            toast.error('Failed to load storage ledger data', {
                description: err?.message || 'Access denied or server error',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        apiClient
            .get<{ success: boolean; tenants: TenantStorageItem[] }>('/media/storage-usage')
            .then((res) => {
                if (isMounted) setTenants(res.tenants || []);
            })
            .catch((err: any) => {
                if (isMounted) {
                    toast.error('Failed to load storage ledger data', {
                        description: err?.message || 'Access denied or server error',
                    });
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                    setRefreshing(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchStorageData();
    };

    const totalGbUsed = tenants.reduce((acc, t) => acc + Number(t.total_gb_used || 0), 0);
    const exceededCount = tenants.filter((t) => t.is_quota_exceeded).length;
    const totalAllocatedGb = tenants.reduce((acc, t) => acc + Number(t.storage_quota_gb || 0), 0);

    const filtered = tenants.filter(
        (t) =>
            t.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.tenant_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.plan.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <HardDrive className="w-6 h-6 text-primary" />
                        Platform Storage Quota & Ledger Monitor
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Cross-tenant video master storage accounting, plan tier quotas, and ledger compliance.
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    className="flex items-center gap-2 self-start md:self-auto"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh Metrics
                </Button>
            </div>

            {/* Platform Storage Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Consumed Storage
                        </CardTitle>
                        <Database className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {loading ? '...' : `${totalGbUsed.toFixed(2)} GB`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Of {totalAllocatedGb.toFixed(1)} GB total provisioned
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Quotas Exceeded
                        </CardTitle>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {loading ? '...' : exceededCount}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Tenants blocked from further uploads
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Active Institutions
                        </CardTitle>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">
                            {loading ? '...' : tenants.length}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Schools tracked in storage ledger
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Storage Table */}
            <Card className="border-border/60 shadow-sm">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Tenant Storage Ledger Breakdown
                            </CardTitle>
                            <CardDescription>
                                Track fractional gigabytes, tier limits, and quota enforcement statuses.
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tenant or plan..."
                                className="w-full pl-9 pr-3 h-9 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-8 text-center text-muted-foreground animate-pulse">
                            Loading storage ledgers...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            No tenant storage records found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3">Institution Name</th>
                                        <th className="px-4 py-3">Plan Tier</th>
                                        <th className="px-4 py-3">Allocated Quota</th>
                                        <th className="px-4 py-3">Used Storage</th>
                                        <th className="px-4 py-3">Usage Bar</th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y border-border">
                                    {filtered.map((tenant) => {
                                        const quota = Number(tenant.storage_quota_gb) || 0.5;
                                        const used = Number(tenant.total_gb_used) || 0;
                                        const percent = Math.min(100, Math.round((used / quota) * 100));

                                        return (
                                            <tr key={tenant.tenant_id} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-foreground">
                                                        {tenant.tenant_name}
                                                    </div>
                                                    <div className="font-mono text-[10px] text-muted-foreground">
                                                        {tenant.tenant_id}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge variant="outline" className="text-xs">
                                                        {tenant.plan}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-foreground font-medium">
                                                    {quota.toFixed(2)} GB
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {used.toFixed(3)} GB
                                                </td>
                                                <td className="px-4 py-3 w-40">
                                                    <div className="space-y-1">
                                                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${percent > 90
                                                                        ? 'bg-rose-500'
                                                                        : percent > 75
                                                                            ? 'bg-amber-500'
                                                                            : 'bg-emerald-500'
                                                                    }`}
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground text-right">
                                                            {percent}%
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {tenant.is_quota_exceeded ? (
                                                        <Badge tone="danger" className="text-xs">
                                                            Exceeded
                                                        </Badge>
                                                    ) : (
                                                        <Badge tone="success" className="text-xs">
                                                            Compliant
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
