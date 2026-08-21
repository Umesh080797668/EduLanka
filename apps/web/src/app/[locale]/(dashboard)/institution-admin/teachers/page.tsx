'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { deactivateTeacher, fetchTeachers, RequestOpts } from '@/lib/api/school';
import type { TeacherProfile } from '@edu-lanka/shared-types';
import { Alert } from '@/components/ui/Alert';
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

export default function TeachersPage() {
    const t = useTranslations('InstitutionAdminTeachers');
    const tc = useTranslations('Common');
    const tf = useTranslations('Confirm');
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [teacherToDelete, setTeacherToDelete] = useState<TeacherProfile | null>(
        null,
    );

    const handleDeleteConfirm = async () => {
        if (!teacherToDelete) return;
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        await deactivateTeacher(teacherToDelete.id, opts);
        setTeachers((prev) =>
            prev.map((item) =>
                item.id === teacherToDelete.id
                    ? { ...item, users: { ...item.users!, is_active: false } }
                    : item,
            ),
        );
    };

    useEffect(() => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        fetchTeachers(opts)
            .then(setTeachers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="mx-auto max-w-6xl">
            <PageHeader
                icon={<Users />}
                title={t('title')}
                badge={
                    !loading && teachers.length > 0 ? (
                        <Badge tone="primary" dot>
                            {teachers.length}
                        </Badge>
                    ) : undefined
                }
                actions={
                    <Link
                        href="/institution-admin/teachers/new"
                        className={buttonClass({ variant: 'primary' })}
                    >
                        <UserPlus className="size-4" />
                        {t('addTeacher')}
                    </Link>
                }
            />

            {loading ? (
                <PageSkeleton rows={6} cols={4} />
            ) : error ? (
                <Alert tone="danger" title={tc('loadFailed')}>
                    {error}
                </Alert>
            ) : teachers.length === 0 ? (
                <EmptyState
                    icon={<Users />}
                    title={t('noTeachers')}
                    action={
                        <Link
                            href="/institution-admin/teachers/new"
                            className={buttonClass({ variant: 'primary' })}
                        >
                            <UserPlus className="size-4" />
                            {t('addTeacher')}
                        </Link>
                    }
                />
            ) : (
                <TableWrap>
                    <Table>
                        <THead>
                            <TR>
                                <TH className="w-36">{t('empNo')}</TH>
                                <TH>{t('name')}</TH>
                                <TH>{t('subjects')}</TH>
                                <TH className="w-28">{t('status')}</TH>
                                <TH align="right" className="w-44">
                                    {t('actions')}
                                </TH>
                            </TR>
                        </THead>
                        <TBody>
                            {teachers.map((teacher, idx) => (
                                <motion.tr
                                    key={teacher.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        transition: { delay: Math.min(idx * 0.03, 0.3) },
                                    }}
                                    className="transition-colors hover:bg-accent/60"
                                >
                                    <TD numeric className="text-muted-foreground">
                                        {teacher.employee_no}
                                    </TD>
                                    <TD>
                                        <div className="font-medium text-foreground">
                                            {teacher.users?.full_name}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {teacher.users?.email}
                                        </div>
                                    </TD>
                                    <TD>
                                        <div className="flex flex-wrap items-center gap-1">
                                            {teacher.subject_areas
                                                .slice(0, 3)
                                                .map((sub, i) => (
                                                    <Badge
                                                        key={i}
                                                        tone="neutral"
                                                        variant="outline"
                                                    >
                                                        {sub.replace('_', ' ')}
                                                    </Badge>
                                                ))}
                                            {teacher.subject_areas.length > 3 && (
                                                <span className="text-xs text-muted-foreground">
                                                    +{teacher.subject_areas.length - 3}
                                                </span>
                                            )}
                                            {teacher.subject_areas.length === 0 && (
                                                <span className="text-sm italic text-muted-foreground">
                                                    {t('noSubjects')}
                                                </span>
                                            )}
                                        </div>
                                    </TD>
                                    <TD>
                                        <Badge
                                            tone={
                                                teacher.users?.is_active
                                                    ? 'success'
                                                    : 'danger'
                                            }
                                            dot
                                        >
                                            {teacher.users?.is_active
                                                ? t('active')
                                                : t('inactive')}
                                        </Badge>
                                    </TD>
                                    <TD align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Link
                                                href={`/institution-admin/teachers/${teacher.id}?edit=true`}
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
                                                href={`/institution-admin/teachers/${teacher.id}`}
                                                aria-label={t('view')}
                                                title={t('view')}
                                                className={buttonClass({
                                                    variant: 'ghost',
                                                    size: 'icon-sm',
                                                })}
                                            >
                                                <Eye className="size-4" />
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={t('deactivateTeacher')}
                                                title={t('deactivateTeacher')}
                                                disabled={!teacher.users?.is_active}
                                                onClick={() =>
                                                    setTeacherToDelete(teacher)
                                                }
                                                className="text-destructive"
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TD>
                                </motion.tr>
                            ))}
                        </TBody>
                    </Table>
                </TableWrap>
            )}

            <MultiStepModal
                isOpen={!!teacherToDelete}
                onClose={() => setTeacherToDelete(null)}
                title={t('deactivateTeacher')}
                steps={[
                    {
                        title: tf('sureTitle'),
                        description: tf('deactivateNamed', {
                            name: teacherToDelete?.users?.full_name ?? '',
                        }),
                        confirmText: tf('proceed'),
                        isDestructive: true,
                    },
                    {
                        title: tf('deactivateTitle'),
                        description: tf('deactivateDesc'),
                        confirmText: t('deactivateTeacher'),
                        isDestructive: true,
                    },
                ]}
                onComplete={handleDeleteConfirm}
            />
        </div>
    );
}
