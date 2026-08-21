'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3, MessageSquare, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { DashboardCardsSkeleton } from '@/components/ui/Skeleton';
import { Progress, StatCard } from '@/components/ui/Stat';
import { Table, TBody, TD, TDEmpty, TH, THead, TR } from '@/components/ui/Table';

interface SmsQuota {
    tenant_id: string;
    tenant_name: string;
    plan: string;
    monthly_quota: number;
    current_month_usage: number;
    failed_deliveries: number;
    overage_count: number;
}

export default function SmsGatewayAdminPage() {
    const t = useTranslations('SystemAdminSms');
    const [quotas, setQuotas] = useState<SmsQuota[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuotas = async () => {
            try {
                const data = await apiClient.get<SmsQuota[]>('/sms/quotas', {
                    skipGlobalToast: true,
                });
                setQuotas(data ?? []);
            } catch (e: any) {
                toast.error(t('loadFailed'), { description: e?.message });
            } finally {
                setLoading(false);
            }
        };
        fetchQuotas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totals = useMemo(
        () =>
            quotas.reduce(
                (acc, q) => ({
                    dispatched: acc.dispatched + (q.current_month_usage ?? 0),
                    failed: acc.failed + (q.failed_deliveries ?? 0),
                    overage: acc.overage + (q.overage_count ?? 0),
                }),
                { dispatched: 0, failed: 0, overage: 0 },
            ),
        [quotas],
    );

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <DashboardCardsSkeleton cards={3} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <PageHeader icon={<Radio />} title={t('title')} description={t('subtitle')} />

            {/* ── Platform rollups ──────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="grid gap-4 sm:grid-cols-3"
            >
                <StatCard
                    label={t('totalDispatches')}
                    value={totals.dispatched.toLocaleString()}
                    hint={t('totalDispatchesHint')}
                    icon={<MessageSquare />}
                    tone="primary"
                />
                <StatCard
                    label={t('overages')}
                    value={totals.overage.toLocaleString()}
                    hint={t('overagesHint')}
                    icon={<BarChart3 />}
                    tone={totals.overage > 0 ? 'warning' : 'success'}
                />
                <StatCard
                    label={t('failed')}
                    value={totals.failed.toLocaleString()}
                    hint={t('failedHint')}
                    icon={<AlertTriangle />}
                    tone={totals.failed > 0 ? 'danger' : 'neutral'}
                />
            </motion.div>

            {/* ── Per-school breakdown ──────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="overflow-hidden rounded-card border border-border bg-card shadow-card"
            >
                <div className="border-b border-border bg-muted/40 px-5 py-4">
                    <h2 className="text-base font-bold tracking-tight text-foreground">
                        {t('breakdown')}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {t('breakdownDesc')}
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                                <THead>
                                    <TR>
                                        <TH>{t('colTenant')}</TH>
                                        <TH className="w-32">{t('colPlan')}</TH>
                                        <TH align="right" className="w-36">
                                            {t('colQuota')}
                                        </TH>
                                        <TH className="w-[28%]">{t('colUsage')}</TH>
                                        <TH align="right" className="w-40">
                                            {t('colOverage')}
                                        </TH>
                                    </TR>
                                </THead>
                                <TBody>
                                    {quotas.length === 0 ? (
                                        <TDEmpty colSpan={5}>
                                            <EmptyState
                                                size="sm"
                                                icon={<MessageSquare />}
                                                title={t('noQuotas')}
                                            />
                                        </TDEmpty>
                                    ) : (
                                        quotas.map((tenant, idx) => {
                                            const quota = tenant.monthly_quota ?? 0;
                                            const used = tenant.current_month_usage ?? 0;
                                            const ratio =
                                                quota > 0
                                                    ? (used / quota) * 100
                                                    : used > 0
                                                      ? 100
                                                      : 0;
                                            const isOverage = (tenant.overage_count ?? 0) > 0;
                                            const unmetered = tenant.plan === 'COMMUNITY';

                                            return (
                                                <TR key={tenant.tenant_id}>
                                                    <TD>
                                                        <motion.span
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{
                                                                delay: Math.min(
                                                                    idx * 0.03,
                                                                    0.3,
                                                                ),
                                                            }}
                                                            className="block font-semibold text-foreground"
                                                        >
                                                            {tenant.tenant_name}
                                                        </motion.span>
                                                    </TD>
                                                    <TD>
                                                        <Badge
                                                            tone="neutral"
                                                            variant="outline"
                                                            size="sm"
                                                        >
                                                            {tenant.plan}
                                                        </Badge>
                                                    </TD>
                                                    <TD align="right" numeric>
                                                        {unmetered
                                                            ? t('unmetered')
                                                            : quota.toLocaleString()}
                                                    </TD>
                                                    <TD>
                                                        <Progress
                                                            size="sm"
                                                            value={ratio}
                                                            tone={
                                                                isOverage
                                                                    ? 'warning'
                                                                    : ratio >= 90
                                                                      ? 'danger'
                                                                      : 'primary'
                                                            }
                                                            valueLabel={used.toLocaleString()}
                                                            label={`${Math.round(Math.min(ratio, 100))}%`}
                                                        />
                                                    </TD>
                                                    <TD align="right">
                                                        {isOverage ? (
                                                            <Badge tone="warning" size="sm">
                                                                +
                                                                {tenant.overage_count.toLocaleString()}{' '}
                                                                {t('smsUnit')}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">
                                                                {t('none')}
                                                            </span>
                                                        )}
                                                    </TD>
                                                </TR>
                                            );
                                        })
                                    )}
                                </TBody>
                            </Table>
                </div>
            </motion.div>
        </div>
    );
}
