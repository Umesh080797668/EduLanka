'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { authManager } from '@/lib/auth-store';
import { fetchGrades, RequestOpts } from '@/lib/api/school';
import type { GradeProfile } from '@edu-lanka/shared-types';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
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

export default function GradesPage() {
    const t = useTranslations('InstitutionAdminGrades');
    const tc = useTranslations('Common');
    const [grades, setGrades] = useState<GradeProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const opts: RequestOpts = {
                    token: authManager.getToken() || '',
                    tenantId: authManager.getTenantId() || '',
                };
                const data = await fetchGrades(opts);
                setGrades(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    return (
        <div className="mx-auto max-w-4xl">
            <PageHeader
                icon={<Layers />}
                title={t('title')}
                description={t('description')}
                badge={
                    !loading && grades.length > 0 ? (
                        <Badge tone="primary" dot>
                            {grades.length}
                        </Badge>
                    ) : undefined
                }
            />

            {loading ? (
                <PageSkeleton rows={8} cols={2} />
            ) : error ? (
                <Alert tone="danger" title={tc('loadFailed')}>
                    {error}
                </Alert>
            ) : grades.length === 0 ? (
                <EmptyState icon={<Layers />} title={t('noGrades')} />
            ) : (
                <TableWrap>
                    <Table>
                        <THead>
                            <TR>
                                <TH>{t('levelContext')}</TH>
                                <TH>{t('labelColumn')}</TH>
                            </TR>
                        </THead>
                        <TBody>
                            {grades.map((grade: any, idx) => (
                                <motion.tr
                                    key={grade.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        transition: { delay: Math.min(idx * 0.03, 0.3) },
                                    }}
                                    className="transition-colors hover:bg-accent/60"
                                >
                                    <TD className="font-medium">
                                        {t('level')} {grade.level}
                                    </TD>
                                    <TD>
                                        <Badge tone="neutral" variant="outline">
                                            {grade.label}
                                        </Badge>
                                    </TD>
                                </motion.tr>
                            ))}
                        </TBody>
                    </Table>
                </TableWrap>
            )}
        </div>
    );
}
