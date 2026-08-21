'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    CalendarDays,
    ChevronLeft,
    Edit2,
    Mail,
    Phone,
    Save,
    School,
    ShieldCheck,
    ShieldOff,
    Ticket,
    UserRound,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import {
    assignClassToStudent,
    fetchClasses,
    fetchStudent,
    RequestOpts,
    updateStudent,
} from '@/lib/api/school';
import type { ClassProfile, StudentProfile } from '@edu-lanka/shared-types';
import { AccountStatusDialog } from '@/components/ui/AccountStatusDialog';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Form';
import ImageUpload from '@/components/ui/ImageUpload';
import { EmptyState } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';

export default function StudentDetailPage() {
    const t = useTranslations('InstitutionAdminStudents');
    const tc = useTranslations('Common');
    const ts = useTranslations('AccountStatus');
    const params = useParams();
    const id = params?.['id'] as string;

    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [classes, setClasses] = useState<ClassProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: '',
        phoneNumber: '',
        gender: '',
        dateOfBirth: '',
    });

    // Class assignment state
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [assigningClass, setAssigningClass] = useState(false);

    // Status Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        if (!id) return;
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };

        Promise.all([fetchStudent(id, opts), fetchClasses(opts)])
            .then(([studentData, classesData]) => {
                setStudent(studentData);
                setClasses(classesData);
                if (studentData.class_id) {
                    setSelectedClassId(studentData.class_id);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

    const handleAssignClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClassId) return;

        setAssigningClass(true);
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            const updated = await assignClassToStudent(id, selectedClassId, opts);
            setStudent(updated);
            toast.success(t('classAssignedSuccess'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        } finally {
            setAssigningClass(false);
        }
    };

    const handleAvatarUpload = async (url: string) => {
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            const updated = await updateStudent(id, { avatarUrl: url }, opts);
            setStudent(updated);
            toast.success(t('avatarUpdated'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        }
    };

    const toggleEdit = () => {
        if (!isEditing && student) {
            setEditForm({
                fullName: student.users?.full_name || '',
                phoneNumber: student.users?.phone_number || '',
                gender: student.gender || '',
                dateOfBirth: student.date_of_birth || '',
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
            const updated = await updateStudent(id, {
                fullName: editForm.fullName,
                phoneNumber: editForm.phoneNumber,
                gender: editForm.gender?.toUpperCase() || null,
                dateOfBirth: editForm.dateOfBirth,
            }, opts);
            setStudent(updated);
            setIsEditing(false);
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        } finally {
            setSavingProfile(false);
        }
    };

    const confirmToggleStatus = async (reason: string) => {
        if (!student || !student.users) return;

        setActionLoading(true);
        const opts: RequestOpts = {
            token: authManager.getToken() || '',
            tenantId: authManager.getTenantId() || '',
        };
        try {
            const { setUserActive } = await import('@/lib/api/school');
            await setUserActive(
                student.user_id,
                !student.users.is_active,
                opts,
                reason,
            );

            // Re-fetch to reflect
            const updated = await fetchStudent(id, opts);
            setStudent(updated);
            toast.success(ts('statusUpdated'));
        } catch (e: any) {
            setError(e.message || tc('somethingWentWrong'));
        } finally {
            setActionLoading(false);
            setShowStatusModal(false);
        }
    };

    if (loading) return <PageSkeleton rows={4} cols={2} />;

    if (!student) {
        return (
            <div className="mx-auto max-w-2xl">
                <EmptyState
                    tone="danger"
                    icon={<UserRound />}
                    title={error || t('studentNotFound')}
                    action={
                        <Link
                            href="/institution-admin/students"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                        >
                            <ChevronLeft className="size-4" />
                            {t('backStudents')}
                        </Link>
                    }
                />
            </div>
        );
    }

    const isActive = !!student.users?.is_active;
    const fullName = student.users?.full_name ?? '';

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <Link
                href="/institution-admin/students"
                className="inline-flex items-center gap-1.5 rounded-input text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                <ChevronLeft className="size-3.5" />
                {t('backStudents')}
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
                        currentImageUrl={student.users?.avatar_url}
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
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                            {student.users?.email || t('none')}
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
                                        icon: <Ticket className="size-3.5" />,
                                        label: t('admissionNumber'),
                                        value: student.admission_no,
                                    },
                                    {
                                        icon: <Mail className="size-3.5" />,
                                        label: t('email'),
                                        value: student.users?.email || t('none'),
                                    },
                                    {
                                        icon: <Phone className="size-3.5" />,
                                        label: t('phone'),
                                        value: student.users?.phone_number || t('none'),
                                    },
                                    {
                                        icon: <CalendarDays className="size-3.5" />,
                                        label: t('dob'),
                                        value: student.date_of_birth || t('notSpecified'),
                                    },
                                    {
                                        icon: <UserRound className="size-3.5" />,
                                        label: t('gender'),
                                        value: student.gender || t('notSpecified'),
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
                                        <dd className="truncate font-medium capitalize text-foreground">
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
                                <Field label={t('phoneNumber')} htmlFor="edit-phone">
                                    <Input
                                        id="edit-phone"
                                        type="tel"
                                        inputSize="sm"
                                        value={editForm.phoneNumber}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                phoneNumber: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label={t('dob')} htmlFor="edit-dob">
                                    <Input
                                        id="edit-dob"
                                        type="date"
                                        inputSize="sm"
                                        value={editForm.dateOfBirth}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                dateOfBirth: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                                <Field label={t('gender')} htmlFor="edit-gender">
                                    <Select
                                        id="edit-gender"
                                        selectSize="sm"
                                        value={editForm.gender}
                                        onChange={(e) =>
                                            setEditForm({
                                                ...editForm,
                                                gender: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="">{t('notSpecified')}</option>
                                        <option value="male">{t('male')}</option>
                                        <option value="female">{t('female')}</option>
                                        <option value="other">{t('other')}</option>
                                    </Select>
                                </Field>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Class assignment ──────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle as="h2">{t('classAssignment')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {student.classes && (
                            <div className="mb-5 rounded-card border border-border bg-primary-subtle p-4">
                                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                                    <School className="size-3.5" />
                                    {t('currentlyAssignedTo')}
                                </div>
                                <div className="mt-1 text-lg font-bold text-foreground">
                                    {(student.classes.grade as any)?.name ??
                                        `${t('gradeShort')} ${student.classes.grade}`}
                                    &nbsp;&ndash;&nbsp;{student.classes.section}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {t('year')} {student.classes.year}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleAssignClass} className="space-y-4">
                            <Field label={t('changeClass')} htmlFor="class-select">
                                <Select
                                    id="class-select"
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                >
                                    <option value="">{t('noClassSelected')}</option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {(cls.grade as any)?.name ??
                                                `${t('gradeShort')} ${cls.grade}`}
                                            &ndash;{cls.section} ({cls.year})
                                        </option>
                                    ))}
                                </Select>
                            </Field>

                            <Button
                                type="submit"
                                block
                                loading={assigningClass}
                                disabled={
                                    !selectedClassId ||
                                    selectedClassId === student.class_id
                                }
                            >
                                {assigningClass ? t('saving') : t('updateAssignment')}
                            </Button>
                        </form>
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
