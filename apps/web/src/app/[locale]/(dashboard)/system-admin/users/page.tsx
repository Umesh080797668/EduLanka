'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, History, Search, ShieldCheck, Users } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { authManager } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { fetchGlobalUsers, setUserActive, RequestOpts } from '@/lib/api/school';
import { AccountStatusDialog } from '@/components/ui/AccountStatusDialog';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Form';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { TableRowsSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Table, TBody, TD, TDEmpty, TH, THead, TR } from '@/components/ui/Table';

/** Audit actions are free-form strings, so bucket them into a badge tone. */
function actionTone(action: string): BadgeTone {
    if (/PROVISION|CREATE|ENROLL|ASSIGN|LINK|RESOLVE/.test(action)) return 'success';
    if (/DELETE|DISABLE|SUSPEND|DEACTIVATE|REMOVE|REJECT|UNLINK/.test(action)) return 'danger';
    if (/UPDATE|CHANGE|PATCH|OVERRIDE/.test(action)) return 'warning';
    return 'info';
}

interface AuditLogPage {
    data: any[];
    total: number;
}

/** Per-user audit stream, loaded lazily when the drawer opens. */
function AuditLogFetcher({ targetUserId }: { targetUserId: string }) {
    const te = useTranslations('SystemAdminUsersExtras');
    const tc = useTranslations('Common');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        apiClient
            .get<AuditLogPage>(
                `/audit-logs?limit=20&offset=0&targetUserId=${targetUserId}`,
                { skipGlobalToast: true },
            )
            .then((res) => {
                if (isMounted) setLogs(res?.data ?? []);
            })
            .catch((err: any) => {
                if (isMounted) setError(err.message || tc('loadFailed'));
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId]);

    if (loading) return <Spinner text={te('loadingAuditStreams')} className="py-10" />;
    if (error) return <Alert tone="danger">{error}</Alert>;
    if (logs.length === 0)
        return <EmptyState size="sm" icon={<History />} title={te('noAuditLogs')} />;

    return (
        <div className="max-h-[55vh] overflow-y-auto rounded-card border border-border">
            <Table>
                <THead>
                    <TR>
                        <TH>{te('auditAction')}</TH>
                        <TH>{te('auditTarget')}</TH>
                        <TH className="w-32">{te('auditIp')}</TH>
                        <TH align="right" className="w-44">
                            {te('auditTime')}
                        </TH>
                    </TR>
                </THead>
                <TBody>
                    {logs.map((log) => (
                        <TR key={log.id}>
                            <TD>
                                <Badge tone={actionTone(log.action ?? '')} size="sm">
                                    {String(log.action ?? '').replace(/_/g, ' ')}
                                </Badge>
                            </TD>
                            <TD>
                                <span className="block text-xs font-semibold text-foreground">
                                    {log.entity_type}
                                </span>
                                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                    {log.entity_id}
                                </span>
                            </TD>
                            <TD className="font-mono text-[11px] text-muted-foreground">
                                {log.ip_address || 'SYS'}
                            </TD>
                            <TD align="right" className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                            </TD>
                        </TR>
                    ))}
                </TBody>
            </Table>
        </div>
    );
}

export default function SystemAdminUsersPage() {
    const t = useTranslations('InstitutionAdminUsers');
    const te = useTranslations('SystemAdminUsersExtras');
    const searchParams = useSearchParams();
    const urlQuery = searchParams?.get('query') ?? '';
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState(urlQuery);
    const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userToConfirm, setUserToConfirm] = useState<any | null>(null);
    const [auditLogTarget, setAuditLogTarget] = useState<any | null>(null);

    // The header search navigates here with ?query=…, which does not remount the
    // page. Adopt it during render rather than syncing it in an effect.
    if (urlQuery !== lastUrlQuery) {
        setLastUrlQuery(urlQuery);
        setSearchQuery(urlQuery);
    }

    // No `setLoading(true)` here: the first load starts in a loading state, and
    // later refreshes update the table in place while a row spinner is showing.
    const refreshUsers = () => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        return fetchGlobalUsers(opts)
            .then(setUsers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refreshUsers();
         
    }, []);

    const confirmToggleStatus = async (reason: string) => {
        if (!userToConfirm) return;
        setActionLoading(userToConfirm.id);
        // The target may belong to another school, so scope the call to its tenant.
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: userToConfirm.tenant_id || authManager.getTenantId() || '',
        };
        try {
            await setUserActive(userToConfirm.id, !userToConfirm.is_active, opts, reason);
            await refreshUsers();
            setUserToConfirm(null);
        } catch (e: any) {
            setError(e.message || te('statusUpdateFailed'));
        } finally {
            setActionLoading(null);
        }
    };

    const filteredUsers = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return users;
        return users.filter((u) =>
            [u.full_name, u.email, u.phone_number, u.tenants?.slug]
                .filter(Boolean)
                .some((field: string) => field.toLowerCase().includes(needle)),
        );
    }, [users, searchQuery]);

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                icon={<Database />}
                title={te('globalEndUsers')}
                description={te('globalEndUsersDesc')}
                badge={
                    !loading ? (
                        <Badge tone="neutral" variant="outline">
                            {users.length}
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
                        placeholder={te('searchPlaceholder')}
                        aria-label={te('searchPlaceholder')}
                        className="sm:max-w-sm"
                    />
                    <p className="numeric text-sm text-muted-foreground">
                        {filteredUsers.length} / {users.length}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <THead>
                            <TR>
                                <TH>{t('nameEmail')}</TH>
                                <TH className="w-36">{te('tenantColumn')}</TH>
                                <TH className="w-40">{t('role')}</TH>
                                <TH className="w-32">{t('status')}</TH>
                                <TH align="right" className="w-44">
                                    {t('actions')}
                                </TH>
                            </TR>
                        </THead>
                        <TBody>
                            {loading ? (
                                <TableRowsSkeleton rows={6} cols={5} />
                            ) : filteredUsers.length === 0 ? (
                                <TDEmpty colSpan={5}>
                                    <EmptyState
                                        size="sm"
                                        icon={<Users />}
                                        title={
                                            searchQuery.trim()
                                                ? te('noUsersMatching')
                                                : t('noUsers')
                                        }
                                    />
                                </TDEmpty>
                            ) : (
                                filteredUsers.map((user, idx) => {
                                    const privileged =
                                        user.role === 'SUPER_ADMIN' ||
                                        user.role === 'SCHOOL_ADMIN';
                                    return (
                                        <TR key={user.id}>
                                            <TD>
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{
                                                        delay: Math.min(idx * 0.03, 0.3),
                                                    }}
                                                    className="flex items-center gap-3"
                                                >
                                                    <Avatar
                                                        name={user.full_name}
                                                        src={user.avatar_url}
                                                        size="sm"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-semibold text-foreground">
                                                            {user.full_name}
                                                        </span>
                                                        <span className="block truncate text-sm text-muted-foreground">
                                                            {user.email ||
                                                                user.phone_number ||
                                                                '—'}
                                                        </span>
                                                    </span>
                                                </motion.div>
                                            </TD>
                                            <TD>
                                                <span className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                                    {user.tenants?.slug || te('sysRoot')}
                                                </span>
                                            </TD>
                                            <TD>
                                                <Badge
                                                    tone={privileged ? 'primary' : 'neutral'}
                                                    variant="outline"
                                                    size="sm"
                                                    className="capitalize"
                                                >
                                                    {privileged && (
                                                        <ShieldCheck className="size-3.5" />
                                                    )}
                                                    {String(user.role ?? '')
                                                        .toLowerCase()
                                                        .replace(/_/g, ' ')}
                                                </Badge>
                                            </TD>
                                            <TD>
                                                <Badge
                                                    tone={
                                                        user.is_active ? 'success' : 'danger'
                                                    }
                                                    dot
                                                    size="sm"
                                                >
                                                    {user.is_active
                                                        ? t('active')
                                                        : t('deactivated')}
                                                </Badge>
                                            </TD>
                                            <TD align="right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label={te('viewAuditLogsBtn')}
                                                        title={te('viewAuditLogsBtn')}
                                                        onClick={() =>
                                                            setAuditLogTarget(user)
                                                        }
                                                    >
                                                        <History className="size-4" />
                                                    </Button>
                                                    {/* Platform owners cannot lock themselves out. */}
                                                    {user.role !== 'SUPER_ADMIN' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            loading={
                                                                actionLoading === user.id
                                                            }
                                                            onClick={() =>
                                                                setUserToConfirm(user)
                                                            }
                                                            className={
                                                                user.is_active
                                                                    ? 'text-destructive'
                                                                    : 'text-success'
                                                            }
                                                        >
                                                            {user.is_active
                                                                ? te('deactivateAccountBtn')
                                                                : te('reactivateAccountBtn')}
                                                        </Button>
                                                    )}
                                                </div>
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
                open={!!userToConfirm}
                onClose={() => setUserToConfirm(null)}
                isActive={!!userToConfirm?.is_active}
                name={userToConfirm?.full_name ?? ''}
                loading={actionLoading === userToConfirm?.id}
                onConfirm={confirmToggleStatus}
            />

            <Dialog
                open={!!auditLogTarget}
                onClose={() => setAuditLogTarget(null)}
                size="xl"
                icon={<History />}
                title={te('auditSequence')}
                description={auditLogTarget?.full_name}
            >
                {auditLogTarget && <AuditLogFetcher targetUserId={auditLogTarget.id} />}
            </Dialog>
        </div>
    );
}
