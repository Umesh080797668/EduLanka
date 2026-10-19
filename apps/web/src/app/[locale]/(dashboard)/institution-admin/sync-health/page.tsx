'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCw,
    Smartphone,
    WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TutorialProvider } from '@/components/TutorialProvider';

interface SyncHealthData {
    tenantId: string;
    totalActiveDevices: number;
    latestSyncSequence: number;
    lastSequenceAllocatedAt: string | null;
    staleDevicesCount: number;
    staleDevices: Array<{
        id: string;
        user_id: string;
        platform: string;
        device_model?: string;
        last_seen_at?: string;
        is_active: boolean;
    }>;
}

export default function SyncHealthPage() {
    const [data, setData] = useState<SyncHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSyncHealth = useCallback(async () => {
        try {
            const res = await apiClient.get<SyncHealthData>('/mobile/sync-health');
            setData(res);
        } catch (err: any) {
            toast.error('Failed to load sync health data', {
                description: err?.message || 'Network error',
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        apiClient
            .get<SyncHealthData>('/mobile/sync-health')
            .then((res) => {
                if (isMounted) setData(res);
            })
            .catch((err: any) => {
                if (isMounted) {
                    toast.error('Failed to load sync health data', {
                        description: err?.message || 'Network error',
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
        fetchSyncHealth();
    };

    const isSystemHealthy = (data?.staleDevicesCount ?? 0) === 0;

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="sync_health">
            <div className="space-y-6 p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Mobile Sync Health & Topology
                            </h1>
                            <Badge
                                tone={isSystemHealthy ? 'success' : 'warning'}
                                className="flex items-center gap-1 text-xs"
                            >
                                {isSystemHealthy ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="w-3.5 h-3.5" /> {data?.staleDevicesCount} Stale
                                    </>
                                )}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Monitor mobile offline-first sequence propagation, active device tokens, and outbox lag.
                        </p>
                    </div>
                    <Button
                        id="sync-health-refresh-btn"
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="flex items-center gap-2 self-start md:self-auto"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh Metrics
                    </Button>
                </div>

                {/* Metric Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card id="sync-health-devices-card" className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Active Devices
                            </CardTitle>
                            <Smartphone className="w-4 h-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">
                                {loading ? '...' : (data?.totalActiveDevices ?? 0)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Registered mobile FCM tokens
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Monotonic Sequence
                            </CardTitle>
                            <Activity className="w-4 h-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">
                                {loading ? '...' : `#${data?.latestSyncSequence ?? 0}`}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Tenant-scoped global sync cursor
                            </p>
                        </CardContent>
                    </Card>

                    <Card id="sync-health-stale-card" className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Stale Outbox Lag
                            </CardTitle>
                            <WifiOff className="w-4 h-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-foreground">
                                {loading ? '...' : (data?.staleDevicesCount ?? 0)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Inactive for &gt; 3 days
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Last Sequence Event
                            </CardTitle>
                            <Clock className="w-4 h-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-semibold truncate text-foreground">
                                {loading
                                    ? '...'
                                    : data?.lastSequenceAllocatedAt
                                        ? new Date(data.lastSequenceAllocatedAt).toLocaleString()
                                        : 'None'}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Latest state commit timestamp
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Stale Devices & Outbox Lag Table */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            Stale Mobile Clients (Lagging Sequence)
                        </CardTitle>
                        <CardDescription>
                            Devices that have not performed a sync pull or handshake in the last 72 hours.
                            Prolonged staleness (&gt; 90 days) will require full snapshot re-hydration (HTTP 410 Gone).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground animate-pulse">
                                Loading device telemetry...
                            </div>
                        ) : !data?.staleDevices || data.staleDevices.length === 0 ? (
                            <div className="py-10 text-center flex flex-col items-center justify-center space-y-2">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-80" />
                                <h4 className="text-base font-semibold text-foreground">All Devices Up-to-Date</h4>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Every registered mobile device has connected within the standard SLA window. No partition divergence detected.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
                                        <tr>
                                            <th className="px-4 py-3">Device Token ID</th>
                                            <th className="px-4 py-3">Platform</th>
                                            <th className="px-4 py-3">Device Model</th>
                                            <th className="px-4 py-3">User ID</th>
                                            <th className="px-4 py-3">Last Seen</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {data.staleDevices.map((device) => (
                                            <tr key={device.id} className="hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-foreground">
                                                    {device.id}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge tone="neutral" variant="outline" className="capitalize text-xs">
                                                        {device.platform}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {device.device_model || 'Unknown Model'}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[140px]">
                                                    {device.user_id}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {device.last_seen_at
                                                        ? new Date(device.last_seen_at).toLocaleString()
                                                        : 'Never'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge tone="warning" className="text-xs">
                                                        Lagging &gt; 3d
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TutorialProvider>
    );
}
