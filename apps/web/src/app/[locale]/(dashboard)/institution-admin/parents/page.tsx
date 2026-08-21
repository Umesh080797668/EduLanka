'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, UserPlus, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { deactivateParent, fetchParents, RequestOpts } from '@/lib/api/school';
import type { ParentProfile } from '@edu-lanka/shared-types';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import MultiStepModal from '@/components/ui/MultiStepModal';
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

export default function ParentsPage() {
    const t = useTranslations('InstitutionAdminParents');
    const tc = useTranslations('Common');
    const tf = useTranslations('Confirm');
    const [parents, setParents] = useState<ParentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [parentToDelete, setParentToDelete] = useState<ParentProfile | null>(null);

    const handleDeleteConfirm = async () => {
        if (!parentToDelete) return;
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        await deactivateParent(parentToDelete.id, opts);
        setParents((prev) =>
            prev.map((p) =>
                p.id === parentToDelete.id ? { ...p, is_active: false } : p,
            ),
        );
    };

    useEffect(() => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        fetchParents(opts)
            .then(setParents)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                icon={<Users2 />}
                title={t('title')}
                badge={
                    !loading && parents.length > 0 ? (
                        <Badge tone="primary" dot>
                            {parents.length}
                        </Badge>
                    ) : undefined
                }
                actions={
                    <Link
                        href="/institution-admin/parents/new"
                        className={buttonClass({ variant: 'primary' })}
                    >
                        <UserPlus className="size-4" />
                        {t('addParent')}
                    </Link>
                }
            />

            {loading ? (
                <PageSkeleton rows={6} cols={4} />
            ) : error ? (
                <Alert tone="danger" title={tc('loadFailed')}>
                    {error}
                </Alert>
            ) : parents.length === 0 ? (
                <EmptyState
                    icon={<Users2 />}
                    title={t('noParents')}
                    action={
                        <Link
                            href="/institution-admin/parents/new"
                            className={buttonClass({ variant: 'primary' })}
                        >
                            <UserPlus className="size-4" />
                            {t('addParent')}
                        </Link>
                    }
                />
            ) : (
                <TableWrap>
                    <Table>
                        <THead>
                            <TR>
                                <TH>{t('parentName')}</TH>
                                <TH>{t('contact')}</TH>
                                <TH className="w-40">{t('childrenLinked')}</TH>
                                <TH className="w-28">{t('status')}</TH>
                                <TH align="right" className="w-44">
                                    {t('actions')}
                                </TH>
                            </TR>
                        </THead>
                        <TBody>
                            {parents.map((parent, idx) => {
                                const linked = parent.parents?.length || 0;
                                return (
                                    <motion.tr
                                        key={parent.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                            transition: {
                                                delay: Math.min(idx * 0.03, 0.3),
                                            },
                                        }}
                                        className="transition-colors hover:bg-accent/60"
                                    >
                                        <TD>
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    name={parent.full_name}
                                                    size="sm"
                                                />
                                                <span className="font-medium text-foreground">
                                                    {parent.full_name}
                                                </span>
                                            </div>
                                        </TD>
                                        <TD className="text-muted-foreground">
                                            {parent.phone_number ||
                                                parent.email ||
                                                t('na')}
                                        </TD>
                                        <TD>
                                            <Badge
                                                tone={linked > 0 ? 'success' : 'neutral'}
                                            >
                                                {linked} {t('children')}
                                            </Badge>
                                        </TD>
                                        <TD>
                                            <Badge
                                                tone={
                                                    parent.is_active
                                                        ? 'success'
                                                        : 'danger'
                                                }
                                                dot
                                            >
                                                {parent.is_active
                                                    ? t('active')
                                                    : t('inactive')}
                                            </Badge>
                                        </TD>
                                        <TD align="right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/institution-admin/parents/${parent.id}?edit=true`}
                                                    aria-label={t('edit')}
                                                    title={t('edit')}
                                                    className={buttonClass({
                                                        variant: 'ghost',
                                                        size: 'icon-sm',
                                                    })}
                                                >
                                                    <Pencil className="size-4" />
                                                </Link>
                                                <Link
                                                    href={`/institution-admin/parents/${parent.id}`}
                                                    className={buttonClass({
                                                        variant: 'outline',
                                                        size: 'sm',
                                                    })}
                                                >
                                                    {t('viewMap')}
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    aria-label={t('deactivateParent')}
                                                    title={t('deactivateParent')}
                                                    disabled={!parent.is_active}
                                                    onClick={() =>
                                                        setParentToDelete(parent)
                                                    }
                                                    className="text-destructive"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </TD>
                                    </motion.tr>
                                );
                            })}
                        </TBody>
                    </Table>
                </TableWrap>
            )}

            <MultiStepModal
                isOpen={!!parentToDelete}
                onClose={() => setParentToDelete(null)}
                title={t('deactivateParent')}
                steps={[
                    {
                        title: tf('sureTitle'),
                        description: tf('deactivateNamed', {
                            name: parentToDelete?.full_name ?? '',
                        }),
                        confirmText: tf('proceed'),
                        isDestructive: true,
                    },
                    {
                        title: tf('deactivateTitle'),
                        description: tf('deactivateDesc'),
                        confirmText: t('deactivateParent'),
                        isDestructive: true,
                    },
                ]}
                onComplete={handleDeleteConfirm}
            />
        </div>
    );
}
