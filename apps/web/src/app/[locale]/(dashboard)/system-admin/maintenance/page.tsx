'use client';

import * as React from 'react';
import {
    AlertCircle,
    AlertTriangle,
    Calendar,
    Clock,
    Info,
    Plus,
    Radio,
    ShieldAlert,
    Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Table, TBody, TD, TDEmpty, TH, THead, TR } from '@/components/ui/Table';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/cn';

interface MaintenanceNotice {
    id: string;
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    scheduled_start: string;
    scheduled_end?: string | null;
    is_active: boolean;
    created_at: string;
}

export default function SystemAdminMaintenancePage() {
    const t = useTranslations('SystemAdminMaintenance');

    const [notices, setNotices] = React.useState<MaintenanceNotice[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [modalOpen, setModalOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [deactivatingId, setDeactivatingId] = React.useState<string | null>(null);

    // Form fields
    const [title, setTitle] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [severity, setSeverity] = React.useState<'INFO' | 'WARNING' | 'CRITICAL'>('WARNING');
    const [scheduledStart, setScheduledStart] = React.useState(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    });
    const [scheduledEnd, setScheduledEnd] = React.useState('');

    const fetchNotices = React.useCallback(async () => {
        try {
            const data = await apiClient.get<MaintenanceNotice[]>('/notices/maintenance', {
                skipGlobalToast: true,
            });
            setNotices(Array.isArray(data) ? data : []);
        } catch (e: any) {
            toast.error(t('loadFailed'), { description: e?.message });
        } finally {
            setLoading(false);
        }
    }, [t]);

    React.useEffect(() => {
        let isMounted = true;

        const loadInitial = async () => {
            try {
                const data = await apiClient.get<MaintenanceNotice[]>('/notices/maintenance', {
                    skipGlobalToast: true,
                });
                if (isMounted) {
                    setNotices(Array.isArray(data) ? data : []);
                }
            } catch (e: any) {
                if (isMounted) {
                    toast.error(t('loadFailed'), { description: e?.message });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void loadInitial();

        return () => {
            isMounted = false;
        };
    }, [t]);

    const activeNotices = React.useMemo(() => notices.filter((n) => n.is_active), [notices]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;

        setSubmitting(true);
        try {
            await apiClient.post('/notices/maintenance', {
                title: title.trim(),
                message: message.trim(),
                severity,
                scheduledStart: scheduledStart ? new Date(scheduledStart).toISOString() : undefined,
                scheduledEnd: scheduledEnd ? new Date(scheduledEnd).toISOString() : undefined,
            });

            toast.success(t('broadcastSuccess'), { description: t('broadcastSuccessDesc') });
            setModalOpen(false);
            setTitle('');
            setMessage('');
            setSeverity('WARNING');
            setScheduledEnd('');
            fetchNotices();
        } catch (e: any) {
            toast.error(t('broadcastFailed'), { description: e?.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        setDeactivatingId(id);
        try {
            await apiClient.delete(`/notices/maintenance/${id}`);
            toast.success(t('deactivated'), { description: t('deactivatedDesc') });
            fetchNotices();
        } catch (e: any) {
            toast.error(t('loadFailed'), { description: e?.message });
        } finally {
            setDeactivatingId(null);
        }
    };

    const getSeverityBadge = (sev: 'INFO' | 'WARNING' | 'CRITICAL') => {
        switch (sev) {
            case 'CRITICAL':
                return (
                    <Badge tone="danger" variant="solid" size="sm">
                        <AlertTriangle className="mr-1 size-3" />
                        CRITICAL
                    </Badge>
                );
            case 'WARNING':
                return (
                    <Badge tone="warning" variant="solid" size="sm">
                        <AlertCircle className="mr-1 size-3" />
                        WARNING
                    </Badge>
                );
            default:
                return (
                    <Badge tone="neutral" variant="soft" size="sm">
                        <Info className="mr-1 size-3" />
                        INFO
                    </Badge>
                );
        }
    };

    return (
        <div className="space-y-8">
            <PageHeader
                title={t('title')}
                description={t('subtitle')}
                icon={<Radio />}
                actions={
                    <Button
                        variant="primary"
                        leadingIcon={<Plus />}
                        onClick={() => setModalOpen(true)}
                    >
                        {t('scheduleButton')}
                    </Button>
                }
            />

            {/* Active Announcements */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Radio className="size-5 text-primary animate-pulse" />
                            {t('activeAnnouncements')}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {t('activeAnnouncementsDesc')}
                        </p>
                    </div>
                    {activeNotices.length > 0 && (
                        <Badge tone="primary" variant="soft">
                            {activeNotices.length} active
                        </Badge>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Spinner size="lg" />
                    </div>
                ) : activeNotices.length === 0 ? (
                    <EmptyState
                        icon={<ShieldAlert />}
                        title={t('noActiveAnnouncements')}
                        description={t('noActiveAnnouncementsDesc')}
                        size="sm"
                    />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {activeNotices.map((notice) => (
                            <motion.div
                                key={notice.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    'rounded-card border p-5 shadow-xs transition-colors flex flex-col justify-between',
                                    notice.severity === 'CRITICAL' &&
                                    'border-destructive/40 bg-destructive/5',
                                    notice.severity === 'WARNING' &&
                                    'border-warning/40 bg-warning/5',
                                    notice.severity === 'INFO' &&
                                    'border-primary/30 bg-primary/5',
                                )}
                            >
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        {getSeverityBadge(notice.severity)}
                                        <Badge tone="success" variant="soft" size="sm">
                                            {t('active')}
                                        </Badge>
                                    </div>
                                    <h3 className="text-base font-bold text-foreground">
                                        {notice.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                        {notice.message}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="size-3.5" />
                                            {new Date(notice.scheduled_start).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                        {notice.scheduled_end && (
                                            <>
                                                <span>→</span>
                                                <span>
                                                    {new Date(notice.scheduled_end).toLocaleString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border/50 mt-4 flex justify-end">
                                    <Button
                                        variant="destructive"
                                        size="xs"
                                        leadingIcon={<Trash2 />}
                                        loading={deactivatingId === notice.id}
                                        onClick={() => handleDeactivate(notice.id)}
                                    >
                                        {t('deactivate')}
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </section>

            {/* Maintenance History */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Calendar className="size-5 text-muted-foreground" />
                        {t('historyTitle')}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {t('historyDesc')}
                    </p>
                </div>

                <Table>
                    <THead>
                        <TR>
                            <TH>{t('colTitle')}</TH>
                            <TH>{t('colSeverity')}</TH>
                            <TH>{t('colWindow')}</TH>
                            <TH>{t('colStatus')}</TH>
                            <TH align="right">{t('colActions')}</TH>
                        </TR>
                    </THead>
                    <TBody>
                        {loading ? (
                            <TR>
                                <TD colSpan={5} className="text-center py-8">
                                    <Spinner text="Loading history..." />
                                </TD>
                            </TR>
                        ) : notices.length === 0 ? (
                            <TDEmpty colSpan={5}>
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                    No maintenance logs found
                                </div>
                            </TDEmpty>
                        ) : (
                            notices.map((n) => (
                                <TR key={n.id}>
                                    <TD>
                                        <div className="font-semibold text-foreground">{n.title}</div>
                                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                                            {n.message}
                                        </div>
                                    </TD>
                                    <TD>{getSeverityBadge(n.severity)}</TD>
                                    <TD>
                                        <div className="text-xs numeric font-medium text-foreground">
                                            {new Date(n.scheduled_start).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                        {n.scheduled_end && (
                                            <div className="text-xs numeric text-muted-foreground">
                                                to{' '}
                                                {new Date(n.scheduled_end).toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </div>
                                        )}
                                    </TD>
                                    <TD>
                                        {n.is_active ? (
                                            <Badge tone="success" variant="solid" size="sm">
                                                {t('active')}
                                            </Badge>
                                        ) : (
                                            <Badge tone="neutral" variant="soft" size="sm">
                                                {t('concluded')}
                                            </Badge>
                                        )}
                                    </TD>
                                    <TD align="right">
                                        {n.is_active && (
                                            <Button
                                                variant="destructive"
                                                size="xs"
                                                loading={deactivatingId === n.id}
                                                onClick={() => handleDeactivate(n.id)}
                                            >
                                                {t('deactivate')}
                                            </Button>
                                        )}
                                    </TD>
                                </TR>
                            ))
                        )}
                    </TBody>
                </Table>
            </section>

            {/* Schedule Maintenance Dialog */}
            <Dialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={t('dialogTitle')}
                description={t('dialogDesc')}
                icon={<Radio />}
                size="md"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <Field label={t('fieldTitle')} required>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={t('fieldTitlePlaceholder')}
                            required
                        />
                    </Field>

                    <Field label={t('fieldMessage')} required>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('fieldMessagePlaceholder')}
                            rows={3}
                            required
                        />
                    </Field>

                    <Field label={t('fieldSeverity')}>
                        <Select
                            value={severity}
                            onChange={(e) => setSeverity(e.target.value as any)}
                        >
                            <option value="INFO">INFO — Informational upgrade / non-disruptive</option>
                            <option value="WARNING">WARNING — Potential latency or degraded service</option>
                            <option value="CRITICAL">CRITICAL — Platform downtime or full outage window</option>
                        </Select>
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={t('fieldStart')} required>
                            <Input
                                type="datetime-local"
                                value={scheduledStart}
                                onChange={(e) => setScheduledStart(e.target.value)}
                                required
                            />
                        </Field>
                        <Field label={t('fieldEnd')}>
                            <Input
                                type="datetime-local"
                                value={scheduledEnd}
                                onChange={(e) => setScheduledEnd(e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setModalOpen(false)}
                            disabled={submitting}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={submitting}
                            disabled={!title.trim() || !message.trim()}
                        >
                            {t('broadcast')}
                        </Button>
                    </div>
                </form>
            </Dialog>
        </div>
    );
}
