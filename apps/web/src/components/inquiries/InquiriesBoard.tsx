'use client';

import { useEffect, useState } from 'react';
import { Check, Inbox, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { authManager } from '@/lib/auth-store';
import { fetchInquiries, RequestOpts, updateInquiryStatus } from '@/lib/api/school';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
    Table,
    TableWrap,
    TBody,
    TD,
    TH,
    THead,
    TR,
} from '@/components/ui/Table';

/**
 * Support-inquiry triage board. Identical for institution and system admins —
 * the API scopes the result set, so the only visible difference is whether the
 * originating school is rendered under the requester's name.
 */
export function InquiriesBoard() {
    const t = useTranslations('Inquiries');
    const tx = useTranslations('InquiriesExtras');
    const tc = useTranslations('Common');
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const opts = (): RequestOpts => ({
        token: authManager.getToken() || '',
        tenantId: authManager.getTenantId() || '',
    });

    const safeFetch = () =>
        fetchInquiries(opts())
            .then(setInquiries)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));

    useEffect(() => {
        safeFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleUpdateStatus = async (
        id: string,
        newStatus: 'RESOLVED' | 'REJECTED',
    ) => {
        setActionLoading(id);
        try {
            await updateInquiryStatus(id, newStatus, opts());
            await safeFetch();
        } catch (err: any) {
            setError(err.message || tc('somethingWentWrong'));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                icon={<Inbox />}
                title={t('title')}
                description={t('description')}
                badge={
                    !loading && inquiries.length > 0 ? (
                        <Badge tone="primary" dot>
                            {inquiries.length}
                        </Badge>
                    ) : undefined
                }
            />

            {error && (
                <Alert
                    tone="danger"
                    title={tx('loadingError')}
                    className="mb-6"
                    onDismiss={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {loading ? (
                <PageSkeleton rows={6} cols={5} />
            ) : inquiries.length === 0 ? (
                <EmptyState icon={<Inbox />} title={t('empty')} />
            ) : (
                <TableWrap>
                    <Table>
                        <THead>
                            <TR>
                                <TH>{t('user')}</TH>
                                <TH>{t('email')}</TH>
                                <TH className="w-32">{t('role')}</TH>
                                <TH className="w-[30%]">{t('message')}</TH>
                                <TH className="w-32">{t('status')}</TH>
                                <TH className="w-28">{t('date')}</TH>
                                <TH align="right" className="w-28">
                                    {tx('actions')}
                                </TH>
                            </TR>
                        </THead>
                        <TBody>
                            {inquiries.map((inq) => (
                                <TR key={inq.id}>
                                    <TD>
                                        <div className="font-medium text-foreground">
                                            {inq.users?.full_name || '—'}
                                        </div>
                                        {inq.tenants?.name && (
                                            <div className="text-xs text-muted-foreground">
                                                {tx('school')}: {inq.tenants.name}
                                            </div>
                                        )}
                                    </TD>
                                    <TD className="text-muted-foreground">
                                        {inq.users?.email || '—'}
                                    </TD>
                                    <TD>
                                        <Badge tone="neutral" variant="outline">
                                            {inq.role}
                                        </Badge>
                                    </TD>
                                    <TD className="whitespace-pre-wrap break-words text-foreground">
                                        {inq.message}
                                    </TD>
                                    <TD>
                                        <Badge
                                            tone={
                                                inq.status === 'PENDING'
                                                    ? 'warning'
                                                    : inq.status === 'REJECTED'
                                                      ? 'danger'
                                                      : 'success'
                                            }
                                            dot
                                        >
                                            {inq.status}
                                        </Badge>
                                    </TD>
                                    <TD className="numeric text-muted-foreground">
                                        {new Date(inq.created_at).toLocaleDateString()}
                                    </TD>
                                    <TD align="right">
                                        {inq.status === 'PENDING' && (
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={tx('resolve')}
                                                    title={tx('resolve')}
                                                    loading={actionLoading === inq.id}
                                                    onClick={() =>
                                                        handleUpdateStatus(
                                                            inq.id,
                                                            'RESOLVED',
                                                        )
                                                    }
                                                    className="text-success"
                                                >
                                                    <Check className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={tx('reject')}
                                                    title={tx('reject')}
                                                    disabled={actionLoading === inq.id}
                                                    onClick={() =>
                                                        handleUpdateStatus(
                                                            inq.id,
                                                            'REJECTED',
                                                        )
                                                    }
                                                    className="text-destructive"
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </TD>
                                </TR>
                            ))}
                        </TBody>
                    </Table>
                </TableWrap>
            )}
        </div>
    );
}

export default InquiriesBoard;
