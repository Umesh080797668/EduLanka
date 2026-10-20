'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    UserCheck,
    Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

interface Child {
    id: string;
    name: string;
    grade?: string;
}

interface AttendanceRecord {
    id: string;
    date: string;
    period: number;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    marked_at: string;
    classes?: { id: string; name: string; grade: number };
}

interface AttendanceSummary {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendancePercentage: number;
}

export default function ParentAttendancePage() {
    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('');
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [summary, setSummary] = useState<AttendanceSummary | null>(null);
    const [loadingChildren, setLoadingChildren] = useState(true);
    const [loadingRecords, setLoadingRecords] = useState(false);

    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // Fetch children for current parent
    useEffect(() => {
        const loadChildren = async () => {
            try {
                setLoadingChildren(true);
                const res = await apiClient.get<{ children: Child[] }>('/parents/me');
                const kids = res.children || [];
                setChildren(kids);
                if (kids.length > 0) {
                    setSelectedChildId(kids[0].id);
                }
            } catch (err: any) {
                console.error('Failed to load linked children:', err);
                toast.error('Could not load your children profile');
            } finally {
                setLoadingChildren(false);
            }
        };
        loadChildren();
    }, []);

    // Fetch attendance for selected child
    useEffect(() => {
        if (!selectedChildId) {
            setRecords([]);
            setSummary(null);
            return;
        }

        const fetchChildAttendance = async () => {
            try {
                setLoadingRecords(true);
                const params = new URLSearchParams();
                if (startDate) params.set('startDate', startDate);
                if (endDate) params.set('endDate', endDate);

                const queryStr = params.toString() ? `?${params.toString()}` : '';
                const res = await apiClient.get<{
                    records: AttendanceRecord[];
                    summary: AttendanceSummary;
                }>(`/attendance/student/${selectedChildId}${queryStr}`);

                setRecords(res.records || []);
                setSummary(res.summary || null);
            } catch (err: any) {
                console.error('Failed to load child attendance:', err);
                toast.error(err?.message || 'Could not load attendance for the selected child');
            } finally {
                setLoadingRecords(false);
            }
        };

        fetchChildAttendance();
    }, [selectedChildId, startDate, endDate]);

    const filteredRecords = useMemo(() => {
        return records.filter((r) => {
            if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
            return true;
        });
    }, [records, filterStatus]);

    const getStatusBadge = (status: AttendanceRecord['status']) => {
        switch (status) {
            case 'PRESENT':
                return (
                    <Badge tone="success" className="gap-1 px-2.5 py-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Present</span>
                    </Badge>
                );
            case 'ABSENT':
                return (
                    <Badge tone="danger" className="gap-1 px-2.5 py-0.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Absent</span>
                    </Badge>
                );
            case 'LATE':
                return (
                    <Badge tone="warning" className="gap-1 px-2.5 py-0.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Late</span>
                    </Badge>
                );
            case 'EXCUSED':
                return (
                    <Badge tone="info" className="gap-1 px-2.5 py-0.5">
                        <AlertCircle className="w-3.5 h-3.5 text-sky-500" />
                        <span>Excused</span>
                    </Badge>
                );
            default:
                return <Badge tone="neutral">{status}</Badge>;
        }
    };

    if (loadingChildren) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <PageSkeleton />
            </div>
        );
    }

    if (children.length === 0) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <PageHeader
                    title="Child Attendance"
                    description="Monitor your children's daily class roll call and attendance consistency."
                />
                <div className="mt-8">
                    <EmptyState
                        title="No Linked Students"
                        description="Your parent account is not currently linked to any enrolled students. Please contact school administration."
                    />
                </div>
            </div>
        );
    }

    const rate = summary?.attendancePercentage ?? 100;
    const rateTone = rate >= 85 ? 'text-emerald-600' : rate >= 70 ? 'text-amber-600' : 'text-rose-600';
    const activeChild = children.find((c) => c.id === selectedChildId);

    return (
        <TutorialProvider role="PARENT" screenId="parent_attendance">
            <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <PageHeader
                        title="Child Attendance"
                        description="Monitor your children's daily class roll call, punctuality, and attendance records."
                    />
                    <div className="flex items-center gap-2">
                        <HelpButton />
                    </div>
                </div>

                {/* Child Switcher Tabs */}
                {children.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3" id="child-switcher">
                        {children.map((child) => (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChildId(child.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${selectedChildId === child.id
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                <span>{child.name}</span>
                                {child.grade && (
                                    <span className="text-xs opacity-75">({child.grade})</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="child-attendance-metrics">
                    <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-md">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-medium uppercase tracking-wider">
                                Attendance Rate
                            </CardDescription>
                            <CardTitle className={`text-3xl font-bold ${rateTone}`}>
                                {summary?.attendancePercentage ?? 0}%
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${rate >= 85 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                    style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {rate >= 80 ? 'Meeting term attendance threshold' : 'Under 80% requirement threshold'}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-md">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-medium uppercase tracking-wider">
                                Days Present
                            </CardDescription>
                            <CardTitle className="text-3xl font-bold text-emerald-600">
                                {summary?.present ?? 0}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                Out of {summary?.total ?? 0} total sessions recorded
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-md">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-medium uppercase tracking-wider">
                                Days Absent
                            </CardDescription>
                            <CardTitle className="text-3xl font-bold text-rose-600">
                                {summary?.absent ?? 0}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                Unexcused class absences
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/60 shadow-sm bg-card/60 backdrop-blur-md">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-medium uppercase tracking-wider">
                                Late / Excused
                            </CardDescription>
                            <CardTitle className="text-3xl font-bold text-amber-600">
                                {(summary?.late ?? 0) + (summary?.excused ?? 0)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                {summary?.late ?? 0} late arrival(s), {summary?.excused ?? 0} excused
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="border border-border/60 shadow-sm bg-card/40 backdrop-blur-md p-4">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {['ALL', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === status
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {status === 'ALL' ? 'All Sessions' : status.charAt(0) + status.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>From</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>To</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            {(startDate || endDate || filterStatus !== 'ALL') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setFilterStatus('ALL');
                                    }}
                                    className="text-xs h-7 px-2"
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Records Table */}
                <Card className="border border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-border/40 bg-muted/20 pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-primary" />
                                    <span>
                                        {activeChild ? `${activeChild.name}'s Attendance Log` : 'Attendance Log'}
                                    </span>
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Showing {filteredRecords.length} recorded session(s)
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    {loadingRecords ? (
                        <div className="p-8">
                            <PageSkeleton />
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="py-12">
                            <EmptyState
                                title="No Attendance Entries Found"
                                description="No attendance records have been registered for this student within the selected filters."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground font-semibold border-b border-border/40">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Period</th>
                                        <th className="px-6 py-3">Class</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3 text-right">Recorded Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filteredRecords.map((rec) => (
                                        <motion.tr
                                            key={rec.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-muted/20 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                                    <span>{rec.date}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                Period {rec.period}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                {rec.classes?.name || `Grade ${rec.classes?.grade || 'General'}`}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getStatusBadge(rec.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                                                {rec.marked_at
                                                    ? new Date(rec.marked_at).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })
                                                    : 'Recorded'}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>
        </TutorialProvider>
    );
}
