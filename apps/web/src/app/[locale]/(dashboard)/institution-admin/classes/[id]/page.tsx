'use client';

import { use, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BookOpen,
    ChevronLeft,
    Plus,
    Star,
    Trash2,
    UserCog,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import {
    assignTeacherToClass,
    fetchClass,
    fetchTeachers,
    removeTeacherFromClass,
    RequestOpts,
} from '@/lib/api/school';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Checkbox, Select } from '@/components/ui/Form';
import { EmptyState, PageHeader, SectionHeading } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/Stat';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ClassDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const t = useTranslations('InstitutionAdminClasses');
    const tc = useTranslations('Common');
    const [cls, setCls] = useState<any | null>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showAssignPanel, setShowAssignPanel] = useState(false);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [isHomeroom, setIsHomeroom] = useState(false);

    const opts = (): RequestOpts => ({
        token: authManager.getToken() || '',
        tenantId: authManager.getTenantId() || '',
    });

    const refreshClass = async () => {
        try {
            const data = await fetchClass(id, opts());
            setCls(data);
        } catch (e: any) {
            setError(e.message || tc('loadFailed'));
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [classData, teachersData] = await Promise.all([
                    fetchClass(id, opts()),
                    fetchTeachers(opts()),
                ]);
                setCls(classData);
                setTeachers(teachersData);
            } catch (e: any) {
                setError(e.message || tc('loadFailed'));
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleAssignTeacher = async () => {
        if (!selectedTeacherId) return;
        setActionLoading('assign');
        try {
            await assignTeacherToClass(
                id,
                { teacherId: selectedTeacherId, isHomeroom },
                opts(),
            );
            setSuccess(t('teacherAssigned'));
            setShowAssignPanel(false);
            setSelectedTeacherId('');
            setIsHomeroom(false);
            await refreshClass();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError(e.message || tc('somethingWentWrong'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveTeacher = async (teacherId: string) => {
        setActionLoading(`remove-${teacherId}`);
        try {
            await removeTeacherFromClass(id, teacherId, opts());
            setSuccess(t('teacherRemoved'));
            await refreshClass();
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError(e.message || tc('somethingWentWrong'));
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <PageSkeleton rows={4} cols={3} />;

    if (!cls) {
        return (
            <div className="mx-auto max-w-2xl">
                <EmptyState
                    tone="danger"
                    icon={<BookOpen />}
                    title={error || t('classNotFound')}
                    action={
                        <Link
                            href="/institution-admin/classes"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                        >
                            <ChevronLeft className="size-4" />
                            {t('backClasses')}
                        </Link>
                    }
                />
            </div>
        );
    }

    const assignedTeacherIds = new Set(
        (cls.class_teachers || []).map((ct: any) => ct.teacher_id || ct.id),
    );
    const availableTeachers = teachers.filter(
        (teacher: any) => !assignedTeacherIds.has(teacher.id),
    );
    const gradeLabel =
        cls.grades?.label ?? `${t('gradeShort')} ${cls.grades?.level ?? cls.grade}`;
    const assignedCount = (cls.class_teachers || []).length;

    return (
        <div className="mx-auto max-w-4xl">
            <PageHeader
                icon={<BookOpen />}
                breadcrumb={
                    <Link
                        href="/institution-admin/classes"
                        className="inline-flex items-center gap-1.5 rounded-input font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                        <ChevronLeft className="size-3.5" />
                        {t('backClasses')}
                    </Link>
                }
                title={t('detailTitle', {
                    grade: gradeLabel,
                    section: cls.section,
                })}
                description={t('detailSubtitle', { year: cls.year })}
                badge={
                    <Badge tone={cls.medium ? 'info' : 'neutral'}>
                        {cls.medium || t('noMediumSet')}
                    </Badge>
                }
            />

            {/* ── Snapshot ──────────────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label={t('students')}
                    value={cls.students?.length ?? 0}
                    icon={<Users />}
                />
                <StatCard
                    label={t('teachersAssigned')}
                    value={assignedCount}
                    icon={<UserCog />}
                    tone="primary"
                />
                <StatCard
                    label={t('academicYear')}
                    value={cls.year}
                    icon={<BookOpen />}
                />
            </div>

            <AnimatePresence>
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-6"
                    >
                        <Alert tone="success">{success}</Alert>
                    </motion.div>
                )}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-6"
                    >
                        <Alert tone="danger" onDismiss={() => setError(null)}>
                            {error}
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Faculty ───────────────────────────────────────────────────── */}
            <Card className="mt-6">
                <CardContent className="pt-6">
                    <SectionHeading
                        title={t('assignedTeachers')}
                        className="mb-5"
                        actions={
                            <Button
                                size="sm"
                                onClick={() => setShowAssignPanel(!showAssignPanel)}
                                leadingIcon={<Plus />}
                                disabled={availableTeachers.length === 0}
                            >
                                {t('assignTeacher')}
                            </Button>
                        }
                    />

                    <AnimatePresence>
                        {showAssignPanel && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mb-6 rounded-card border border-border bg-muted/40 p-4">
                                    <p className="mb-3 text-sm font-semibold text-foreground">
                                        {t('assignPanelTitle')}
                                    </p>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <Select
                                            aria-label={t('selectTeacher')}
                                            value={selectedTeacherId}
                                            onChange={(e) =>
                                                setSelectedTeacherId(e.target.value)
                                            }
                                            className="flex-1"
                                        >
                                            <option value="">
                                                {t('selectTeacher')}
                                            </option>
                                            {availableTeachers.map((teacher: any) => (
                                                <option
                                                    key={teacher.id}
                                                    value={teacher.id}
                                                >
                                                    {teacher.users?.full_name ||
                                                        teacher.full_name ||
                                                        teacher.id}
                                                </option>
                                            ))}
                                        </Select>
                                        <Checkbox
                                            checked={isHomeroom}
                                            onChange={(e) =>
                                                setIsHomeroom(e.target.checked)
                                            }
                                            label={t('homeroomTeacher')}
                                        />
                                        <Button
                                            onClick={handleAssignTeacher}
                                            disabled={!selectedTeacherId}
                                            loading={actionLoading === 'assign'}
                                            leadingIcon={<Plus />}
                                        >
                                            {t('assign')}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {assignedCount === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={<UserCog />}
                            title={t('noTeachersAssigned')}
                            description={t('noTeachersAssignedDesc')}
                        />
                    ) : (
                        <ul className="space-y-2">
                            {(cls.class_teachers || []).map((ct: any, idx: number) => {
                                const teacher = ct.teachers || ct;
                                const user = teacher.users || {};
                                const teacherId = ct.teacher_id || ct.id;

                                return (
                                    <motion.li
                                        key={teacherId}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                            transition: {
                                                delay: Math.min(idx * 0.04, 0.3),
                                            },
                                        }}
                                        className="flex items-center justify-between gap-3 rounded-card border border-border bg-muted/40 px-4 py-3"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar
                                                name={user.full_name || '—'}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="truncate text-sm font-semibold text-foreground">
                                                        {user.full_name || '—'}
                                                    </span>
                                                    {ct.is_homeroom && (
                                                        <Badge tone="warning" size="sm">
                                                            <Star className="size-3" />
                                                            {t('homeroom')}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {user.email || ''}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={t('removeTeacher')}
                                            title={t('removeTeacher')}
                                            loading={
                                                actionLoading === `remove-${teacherId}`
                                            }
                                            onClick={() => handleRemoveTeacher(teacherId)}
                                            className="text-destructive"
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </motion.li>
                                );
                            })}
                        </ul>
                    )}

                    {availableTeachers.length === 0 && assignedCount > 0 && (
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                            {t('noTeachersAvailable')}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
