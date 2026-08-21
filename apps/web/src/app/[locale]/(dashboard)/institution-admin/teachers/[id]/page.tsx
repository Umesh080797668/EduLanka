'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    BadgeCheck,
    BookMarked,
    CalendarDays,
    ChevronLeft,
    Edit2,
    GraduationCap,
    Mail,
    Phone,
    Save,
    ShieldCheck,
    ShieldOff,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { fetchTeacher, RequestOpts, updateTeacher } from '@/lib/api/school';
import type { TeacherProfile } from '@edu-lanka/shared-types';
import { AccountStatusDialog } from '@/components/ui/AccountStatusDialog';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Form';
import ImageUpload from '@/components/ui/ImageUpload';
import { EmptyState } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';

/** Enum members are SCREAMING_SNAKE; render them as readable title case. */
function subjectLabel(value: string): string {
    return value
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

export default function TeacherDetailPage() {
    const t = useTranslations('InstitutionAdminTeachers');
    const tc = useTranslations('Common');
    const ts = useTranslations('AccountStatus');
    const params = useParams();
    const id = params?.['id'] as string;

    const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: '',
        phoneNumber: '',
        hireDate: '',
    });

    // Status Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };

        fetchTeacher(id, opts)
            .then(setTeacher)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAvatarUpload = async (url: string) => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            const updated = await updateTeacher(id, { avatarUrl: url }, opts);
            setTeacher(updated);
            toast.success(t('avatarUpdated'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        }
    };

    const toggleEdit = () => {
        if (!isEditing && teacher) {
            setEditForm({
                fullName: teacher.users?.full_name || '',
                phoneNumber: teacher.users?.phone_number || '',
                hireDate: teacher.hire_date || '',
            });
        }
        setIsEditing(!isEditing);
    };

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            // hireDate is @IsDateString on the API — omit it rather than
            // sending an empty string, which would fail validation.
            const payload: Record<string, unknown> = {
                fullName: editForm.fullName,
                phoneNumber: editForm.phoneNumber,
            };
            if (editForm.hireDate) payload['hireDate'] = editForm.hireDate;

            const updated = await updateTeacher(id, payload, opts);
            setTeacher(updated);
            setIsEditing(false);
            toast.success(t('profileUpdated'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        } finally {
            setSavingProfile(false);
        }
    };

    const confirmToggleStatus = async (reason: string) => {
        if (!teacher || !teacher.users) return;

        setActionLoading(true);
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            const { setUserActive } = await import('@/lib/api/school');
            await setUserActive(
                teacher.user_id,
                !teacher.users.is_active,
                opts,
                reason,
            );

            // Re-fetch to reflect
            const updated = await fetchTeacher(id, opts);
            setTeacher(updated);
            toast.success(ts('statusUpdated'));
        } catch (e: any) {
            setError(e.message || tc('somethingWentWrong'));
        } finally {
            setActionLoading(false);
            setShowStatusModal(false);
        }
    };

    if (loading) return <PageSkeleton rows={4} cols={2} />;

    if (!teacher) {
        return (
            <div className="mx-auto max-w-2xl">
                <EmptyState
                    tone="danger"
                    icon={<GraduationCap />}
                    title={error || t('teacherNotFound')}
                    action={
                        <Link
                            href="/institution-admin/teachers"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                        >
                            <ChevronLeft className="size-4" />
                            {t('backTeachers')}
                        </Link>
                    }
                />
            </div>
        );
    }

    const isActive = !!teacher.users?.is_active;
    const fullName = teacher.users?.full_name ?? '';
    const subjects = teacher.subject_areas ?? [];

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <Link
                href="/institution-admin/teachers"
                className="inline-flex items-center gap-1.5 rounded-input text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                <ChevronLeft className="size-3.5" />
                {t('backTeachers')}
            </Link>

            {error && (
                <Alert tone="danger" onDismiss={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* ── Identity ──────────────────────────────────────────────────── */}
            <Card>
                <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
                    <ImageUpload
                        currentImageUrl={teacher.users?.avatar_url}
                        onUploadSuccess={handleAvatarUpload}
                        onError={(err) => toast.error(err)}
                        size={72}
                        className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
                                {fullName}
                            </h1>
                            <Badge tone={isActive ? 'success' : 'danger'} dot>
                                {isActive ? t('active') : t('inactive')}
                            </Badge>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <span className="truncate">
                                {teacher.users?.email || t('none')}
                            </span>
                            <span aria-hidden>&middot;</span>
                            <span className="numeric">{teacher.employee_no}</span>
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        onClick={() => setShowStatusModal(true)}
                        leadingIcon={isActive ? <ShieldOff /> : <ShieldCheck />}
                        className={isActive ? 'text-destructive' : 'text-success'}
                    >
                        {isActive ? ts('suspendAccount') : ts('reactivateAccount')}
                    </Button>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ── Profile ───────────────────────────────────────────────── */}
                <Card>
                    <CardHeader className="flex-row items-center justify-between gap-3">
                        <CardTitle as="h2">{t('profileInfo')}</CardTitle>
                        {!isEditing ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleEdit}
                                leadingIcon={<Edit2 />}
                            >
                                {t('editProfile')}
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleEdit}
                                    disabled={savingProfile}
                                >
                                    {tc('cancel')}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSaveProfile}
                                    loading={savingProfile}
                                    leadingIcon={<Save />}
                                >
                                    {tc('save')}
                                </Button>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent>
                        {!isEditing ? (
                            <dl className="divide-y divide-border text-sm">
                                {[
                                    {
                                        icon: <BadgeCheck className="size-3.5" />,
                                        label: t('employeeNumber'),
                                        value: teacher.employee_no,
                                    },
                                    {
                                        icon: <Mail className="size-3.5" />,
                                        label: t('email'),
                                        value: teacher.users?.email || t('none'),
                                    },
                                    {
                                        icon: <Phone className="size-3.5" />,
                                        label: t('phone'),
                                        value: teacher.users?.phone_number || t('none'),
                                    },
                                    {
                                        icon: <CalendarDays className="size-3.5" />,
                                        label: t('hireDate'),
                                        value: teacher.hire_date || t('notSpecified'),
                                    },
                                ].map(({ icon, label, value }) => (
                                    <div
                                        key={label}
                                        className="flex items-center justify-between gap-4 py-2.5"
                                    >
                                        <dt className="flex items-center gap-2 text-muted-foreground">
                                            {icon}
                                            {label}
                                        </dt>
                                        <dd className="truncate font-medium text-foreground">
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <div className="space-y-4">
                                <Field label={t('fullName')} htmlFor="edit-full-name">
                                    <Input
                                        id="edit-full-name"
                                        inputSize="sm"
                                        value={editForm.fullName}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                fullName: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label={t('mobileNumber')} htmlFor="edit-phone">
                                    <Input
                                        id="edit-phone"
                                        type="tel"
                                        inputSize="sm"
                                        leadingIcon={<Phone />}
                                        value={editForm.phoneNumber}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                phoneNumber: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label={t('hireDate')} htmlFor="edit-hire-date">
                                    <Input
                                        id="edit-hire-date"
                                        type="date"
                                        inputSize="sm"
                                        value={editForm.hireDate}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                hireDate: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Teaching load ─────────────────────────────────────────── */}
                <Card>
                    <CardHeader className="flex-row items-center justify-between gap-3">
                        <CardTitle as="h2">{t('subjectAreas')}</CardTitle>
                        {subjects.length > 0 && (
                            <Badge tone="neutral" variant="outline" size="sm">
                                {t('subjectCount', { count: subjects.length })}
                            </Badge>
                        )}
                    </CardHeader>
                    <CardContent>
                        {subjects.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {subjects.map((subject) => (
                                    <Badge key={subject} tone="primary">
                                        {subjectLabel(subject)}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                {t('noSubjects')}
                            </p>
                        )}

                        <hr className="my-6 border-border" />

                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                            <BookMarked className="size-4 text-muted-foreground" />
                            {t('assignedClasses')}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t('phase2Manage')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <AccountStatusDialog
                open={showStatusModal}
                onClose={() => setShowStatusModal(false)}
                isActive={isActive}
                name={fullName}
                loading={actionLoading}
                onConfirm={confirmToggleStatus}
            />
        </div>
    );
}
