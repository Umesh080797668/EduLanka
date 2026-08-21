'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, ShieldCheck, Smartphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { TenantStatus } from '@edu-lanka/shared-types';

import { authManager } from '@/lib/auth-store';
import { fetchTenants, toggleTenantSms, RequestOpts } from '@/lib/api/school';
import { AccountStatusDialog } from '@/components/ui/AccountStatusDialog';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Form';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { TableRowsSkeleton } from '@/components/ui/Skeleton';
import { Table, TBody, TD, TDEmpty, TH, THead, TR } from '@/components/ui/Table';

/** Lifecycle states map onto badge tones; anything unknown reads as suspended. */
const STATUS_TONE: Record<string, BadgeTone> = {
    [TenantStatus.ACTIVE]: 'success',
    [TenantStatus.PROVISIONING]: 'info',
};

export default function SystemAdminTenantsPage() {
    const t = useTranslations('SystemAdminTenants');
    const searchParams = useSearchParams();
    const urlQuery = searchParams?.get('query') ?? '';
    const [tenants, setTenants] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState(urlQuery);
    const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tenantToConfirm, setTenantToConfirm] = useState<any | null>(null);

    // The header search navigates here with ?query=…, which does not remount the
    // page. Adopt it during render rather than syncing it in an effect.
    if (urlQuery !== lastUrlQuery) {
        setLastUrlQuery(urlQuery);
        setSearchQuery(urlQuery);
    }

    const opts = (): RequestOpts => ({
        token: authManager.getToken() || '',
        tenantId: authManager.getTenantId() || '',
    });

    // No `setLoading(true)` here: the first load starts in a loading state, and
    // later refreshes update the table in place while a row spinner is showing.
    const refreshTenants = () =>
        fetchTenants(opts())
            .then(setTenants)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));

    useEffect(() => {
        refreshTenants();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const confirmToggleStatus = async (reason: string) => {
        if (!tenantToConfirm) return;
        setActionLoading(tenantToConfirm.id);
        try {
            const { updateTenantStatus } = await import('@/lib/api/school');
            const nextStatus =
                tenantToConfirm.status === TenantStatus.ACTIVE
                    ? TenantStatus.SUSPENDED
                    : TenantStatus.ACTIVE;
            await updateTenantStatus(tenantToConfirm.id, nextStatus, opts(), reason);
            await refreshTenants();
            setTenantToConfirm(null);
        } catch (e: any) {
            setError(e.message || t('statusUpdateFailed'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleSmsToggle = async (tenantId: string) => {
        const target = tenants.find((tnt) => tnt.id === tenantId);
        if (!target) return;
        const previous = target.smsApproved;

        setActionLoading(`sms-${tenantId}`);
        // Optimistic flip: the switch responds immediately and rolls back on failure.
        setTenants((prev) =>
            prev.map((tnt) =>
                tnt.id === tenantId ? { ...tnt, smsApproved: !previous } : tnt,
            ),
        );

        try {
            await toggleTenantSms(tenantId, opts());
        } catch (e: any) {
            setTenants((prev) =>
                prev.map((tnt) =>
                    tnt.id === tenantId ? { ...tnt, smsApproved: previous } : tnt,
                ),
            );
            setError(e.message || t('smsToggleFailed'));
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTenants = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return tenants;
        return tenants.filter((tnt) =>
            [tnt.name, tnt.slug, tnt.contactEmail]
                .filter(Boolean)
                .some((field: string) => field.toLowerCase().includes(needle)),
        );
    }, [tenants, searchQuery]);

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                icon={<Building2 />}
                title={t('title')}
                description={t('subtitle')}
                badge={
                    !loading ? (
                        <Badge tone="neutral" variant="outline">
                            {tenants.length}
                        </Badge>
                    ) : undefined
                }
            />

            {error && (
                <Alert tone="danger" className="mb-6" onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-card border border-border bg-card shadow-card"
            >
                {/* ── Toolbar ───────────────────────────────────────────────── */}
                <div className="flex flex-col gap-3 border-b border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <Input
                        type="search"
                        inputSize="sm"
                        leadingIcon={<Search />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('search')}
                        aria-label={t('search')}
                        className="sm:max-w-sm"
                    />
                    <p className="numeric text-sm text-muted-foreground">
                        {filteredTenants.length} / {tenants.length}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <THead>
                            <TR>
                                <TH>{t('tenant')}</TH>
                                <TH className="w-36">{t('status')}</TH>
                                <TH className="w-32">{t('plan')}</TH>
                                <TH className="w-40">{t('type')}</TH>
                                <TH className="w-28">{t('sms')}</TH>
                                <TH align="right" className="w-36">
                                    {t('actions')}
                                </TH>
                            </TR>
                        </THead>
                        <TBody>
                            {loading ? (
                                <TableRowsSkeleton rows={6} cols={6} />
                            ) : filteredTenants.length === 0 ? (
                                <TDEmpty colSpan={6}>
                                    <EmptyState
                                        size="sm"
                                        icon={<Building2 />}
                                        title={
                                            searchQuery.trim()
                                                ? t('noMatches')
                                                : t('noTenants')
                                        }
                                    />
                                </TDEmpty>
                            ) : (
                                filteredTenants.map((tnt, idx) => {
                                    const isActive = tnt.status === TenantStatus.ACTIVE;
                                    return (
                                        <TR key={tnt.id}>
                                            <TD>
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{
                                                        delay: Math.min(idx * 0.03, 0.3),
                                                    }}
                                                    className="flex items-center gap-3"
                                                >
                                                    <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary-subtle text-sm font-bold uppercase text-primary-subtle-foreground">
                                                        {tnt.slug?.substring(0, 2) || 'SC'}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="flex items-center gap-2">
                                                            <span className="truncate font-semibold text-foreground">
                                                                {tnt.name}
                                                            </span>
                                                            <span className="shrink-0 rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                                                {tnt.slug}
                                                            </span>
                                                        </span>
                                                        <span className="block truncate text-sm text-muted-foreground">
                                                            {tnt.contactEmail}
                                                        </span>
                                                    </span>
                                                </motion.div>
                                            </TD>
                                            <TD>
                                                <Badge
                                                    tone={
                                                        STATUS_TONE[tnt.status] ?? 'danger'
                                                    }
                                                    dot
                                                    size="sm"
                                                >
                                                    {tnt.status}
                                                </Badge>
                                            </TD>
                                            <TD>
                                                <Badge
                                                    tone={
                                                        tnt.plan === 'PRO'
                                                            ? 'primary'
                                                            : 'neutral'
                                                    }
                                                    variant="outline"
                                                    size="sm"
                                                >
                                                    {tnt.plan === 'PRO' && (
                                                        <ShieldCheck className="size-3.5" />
                                                    )}
                                                    {tnt.plan}
                                                </Badge>
                                            </TD>
                                            <TD className="text-muted-foreground">
                                                {tnt.schoolType?.replace(/_/g, ' ') ||
                                                    t('unknownType')}
                                            </TD>
                                            <TD>
                                                <span className="flex items-center gap-2">
                                                    <Smartphone
                                                        className="size-4 shrink-0 text-muted-foreground"
                                                        aria-hidden
                                                    />
                                                    <Switch
                                                        checked={!!tnt.smsApproved}
                                                        disabled={
                                                            actionLoading ===
                                                            `sms-${tnt.id}`
                                                        }
                                                        onCheckedChange={() =>
                                                            handleSmsToggle(tnt.id)
                                                        }
                                                        aria-label={t('toggleSmsTooltip')}
                                                    />
                                                </span>
                                            </TD>
                                            <TD align="right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    loading={actionLoading === tnt.id}
                                                    onClick={() => setTenantToConfirm(tnt)}
                                                    className={
                                                        isActive
                                                            ? 'text-destructive'
                                                            : 'text-success'
                                                    }
                                                >
                                                    {isActive
                                                        ? t('deactivate')
                                                        : t('reactivateShort')}
                                                </Button>
                                            </TD>
                                        </TR>
                                    );
                                })
                            )}
                        </TBody>
                    </Table>
                </div>
            </motion.div>

            <AccountStatusDialog
                open={!!tenantToConfirm}
                onClose={() => setTenantToConfirm(null)}
                isActive={tenantToConfirm?.status === TenantStatus.ACTIVE}
                name={tenantToConfirm?.name ?? ''}
                loading={actionLoading === tenantToConfirm?.id}
                onConfirm={confirmToggleStatus}
            />
        </div>
    );
}
