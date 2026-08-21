'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Clock, Search, Server, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { TableRowsSkeleton } from '@/components/ui/Skeleton';
import { Table, TBody, TD, TDEmpty, TH, THead, TR } from '@/components/ui/Table';

const LIMIT = 20;

/** Audit actions are free-form strings, so bucket them into a badge tone. */
function actionTone(action: string): BadgeTone {
    if (/PROVISION|CREATE|ENROLL|ASSIGN|LINK|RESOLVE/.test(action)) return 'success';
    if (/DELETE|DISABLE|SUSPEND|DEACTIVATE|REMOVE|REJECT|UNLINK/.test(action))
        return 'danger';
    if (/UPDATE|CHANGE|PATCH|OVERRIDE/.test(action)) return 'warning';
    return 'info';
}

interface AuditLogPage {
    data: any[];
    total: number;
}

export default function AuditLogsPage() {
    const t = useTranslations('SystemAdminAuditLogs');
    const tc = useTranslations('Common');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let isMounted = true;
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await apiClient.get<AuditLogPage>(
                    `/audit-logs?limit=${LIMIT}&offset=${(page - 1) * LIMIT}`,
                    { skipGlobalToast: true },
                );
                if (isMounted) {
                    setLogs(res?.data ?? []);
                    setTotal(res?.total ?? 0);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || tc('loadFailed'));
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchLogs();
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    // Server-side pagination stays authoritative; the filter narrows the page
    // that is currently loaded, which is what the record counter reflects.
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return logs;
        return logs.filter((log) =>
            [
                log.action,
                log.entity_type,
                log.entity_id,
                log.actor_role,
                log.actor_id,
                log.ip_address,
            ]
                .filter(Boolean)
                .some((field: string) => String(field).toLowerCase().includes(needle)),
        );
    }, [logs, query]);

    const lastPage = Math.max(1, Math.ceil(total / LIMIT));

    return (
        <div className="mx-auto max-w-7xl">
            <PageHeader
                icon={<Shield />}
                title={t('title')}
                description={t('subtitle')}
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
                        placeholder={t('filterPlaceholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label={t('filterPlaceholder')}
                        className="sm:max-w-sm"
                    />
                    <p className="text-sm text-muted-foreground">
                        {t('totalRecords')}{' '}
                        <span className="numeric font-bold text-foreground">
                            {total}
                        </span>
                        {query.trim() && (
                            <span className="ml-2 text-xs">
                                ({t('filterScope', { count: visible.length })})
                            </span>
                        )}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <THead>
                            <TR>
                                <TH>{t('colAction')}</TH>
                                <TH>{t('colTarget')}</TH>
                                <TH>{t('colActor')}</TH>
                                <TH>{t('colIp')}</TH>
                                <TH>{t('colTime')}</TH>
                            </TR>
                        </THead>
                        <TBody>
                            {loading ? (
                                <TableRowsSkeleton rows={6} cols={5} />
                            ) : visible.length === 0 ? (
                                <TDEmpty colSpan={5}>
                                    <EmptyState
                                        size="sm"
                                        icon={<AlertCircle />}
                                        title={query.trim() ? tc('noResults') : t('noLogs')}
                                    />
                                </TDEmpty>
                            ) : (
                                visible.map((log) => (
                                    <TR key={log.id}>
                                        <TD className="align-top">
                                            <Badge
                                                tone={actionTone(log.action ?? '')}
                                                size="sm"
                                            >
                                                {String(log.action ?? '').replace(
                                                    /_/g,
                                                    ' ',
                                                )}
                                            </Badge>
                                        </TD>
                                        <TD className="align-top">
                                            <div className="font-semibold text-foreground">
                                                {log.entity_type}
                                            </div>
                                            <div className="font-mono text-xs text-muted-foreground">
                                                {log.entity_id}
                                            </div>
                                        </TD>
                                        <TD className="align-top">
                                            <div className="font-semibold text-foreground">
                                                {log.actor_role}
                                            </div>
                                            <div
                                                className="max-w-36 truncate font-mono text-xs text-muted-foreground"
                                                title={log.actor_id}
                                            >
                                                {log.actor_id}
                                            </div>
                                        </TD>
                                        <TD className="align-top">
                                            <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                                                <Server className="size-3.5 shrink-0" />
                                                {log.ip_address || '—'}
                                            </span>
                                        </TD>
                                        <TD className="align-top">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="size-3.5 shrink-0" />
                                                {new Date(
                                                    log.created_at,
                                                ).toLocaleString()}
                                            </span>
                                        </TD>
                                    </TR>
                                ))
                            )}
                        </TBody>
                    </Table>
                </div>

                {/* ── Pagination ────────────────────────────────────────────── */}
                <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 p-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                    >
                        {t('previous')}
                    </Button>
                    <span className="numeric text-sm text-muted-foreground">
                        {t('page')} {page} {t('of')} {lastPage}
                    </span>
                    <Button
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * LIMIT >= total || loading}
                    >
                        {t('next')}
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
