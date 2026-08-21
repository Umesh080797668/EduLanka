'use client';

import { use, useEffect, useState } from 'react';
import {
    ChevronLeft,
    Edit2,
    Link2,
    Link2Off,
    Mail,
    Phone,
    Save,
    ShieldCheck,
    ShieldOff,
    UserRound,
    Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import {
    fetchParent,
    fetchStudents,
    linkStudentToParent,
    RequestOpts,
    unlinkStudentFromParent,
    updateParent,
} from '@/lib/api/school';
import type { ParentProfile, StudentProfile } from '@edu-lanka/shared-types';
import { ParentRelationship } from '@edu-lanka/shared-types';
import { AccountStatusDialog } from '@/components/ui/AccountStatusDialog';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Form';
import ImageUpload from '@/components/ui/ImageUpload';
import { EmptyState } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';

/** Enum members are SCREAMING_SNAKE; render them as readable title case. */
function titleCase(value: string): string {
    return value
        .split('_')
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

export default function ParentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const t = useTranslations('InstitutionAdminParents');
    const tc = useTranslations('Common');
    const ts = useTranslations('AccountStatus');

    const [parent, setParent] = useState<ParentProfile | null>(null);
    const [allStudents, setAllStudents] = useState<StudentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Mapping state
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [relationship, setRelationship] = useState<ParentRelationship>(
        ParentRelationship.FATHER,
    );
    const [mapping, setMapping] = useState(false);
    const [unlinkTarget, setUnlinkTarget] = useState<{
        studentId: string;
        name: string;
    } | null>(null);
    const [unlinking, setUnlinking] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
    });

    // Status Modal State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const opts = (): RequestOpts => ({
        token: authManager.getToken() || '',
        tenantId: authManager.getTenantId() || '',
    });

    const loadData = async () => {
        try {
            const [parentData, studentsData] = await Promise.all([
                fetchParent(id, opts()),
                fetchStudents(opts()),
            ]);
            setParent(parentData);
            setEditForm({
                fullName: parentData.full_name,
                email: parentData.email || '',
                phoneNumber: parentData.phone_number || '',
            });
            setAllStudents(studentsData);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        Promise.resolve().then(() => loadData());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMapping(true);
        try {
            await linkStudentToParent(
                id,
                { studentId: selectedStudentId, relationship },
                opts(),
            );
            setSelectedStudentId('');
            await loadData();
            toast.success(t('studentLinked'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        } finally {
            setMapping(false);
        }
    };

    const confirmUnlink = async () => {
        if (!unlinkTarget) return;
        setUnlinking(true);
        try {
            await unlinkStudentFromParent(id, unlinkTarget.studentId, opts());
            await loadData();
            toast.success(t('studentUnlinked'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        } finally {
            setUnlinking(false);
            setUnlinkTarget(null);
        }
    };

    const handleAvatarUpload = async (url: string) => {
        if (!parent) return;
        try {
            await updateParent(parent.id, { avatarUrl: url }, opts());
            await loadData();
            toast.success(t('avatarUpdated'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        }
    };

    const handleSaveEdit = async () => {
        if (!parent) return;
        setSavingEdit(true);
        try {
            await updateParent(parent.id, editForm, opts());
            setIsEditing(false);
            await loadData();
            toast.success(t('profileUpdated'));
        } catch (err: any) {
            toast.error(err.message || tc('somethingWentWrong'));
        } finally {
            setSavingEdit(false);
        }
    };

    const confirmToggleStatus = async (reason: string) => {
        if (!parent) return;

        setActionLoading(true);
        try {
            const { setUserActive } = await import('@/lib/api/school');
            await setUserActive(parent.id, !parent.is_active, opts(), reason);
            await loadData();
            toast.success(ts('statusUpdated'));
        } catch (e: any) {
            setError(e.message || tc('somethingWentWrong'));
        } finally {
            setActionLoading(false);
            setShowStatusModal(false);
        }
    };

    if (loading) return <PageSkeleton rows={4} cols={2} />;

    if (!parent) {
        return (
            <div className="mx-auto max-w-2xl">
                <EmptyState
                    tone="danger"
                    icon={<UserRound />}
                    title={error || t('parentNotFound')}
                    action={
                        <Link
                            href="/institution-admin/parents"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                        >
                            <ChevronLeft className="size-4" />
                            {t('backParents')}
                        </Link>
                    }
                />
            </div>
        );
    }

    const children = parent.parents ?? [];
    const linkedStudentIds = children.map((pc) => pc.student_id);
    const availableStudents = allStudents.filter(
        (student) => !linkedStudentIds.includes(student.id),
    );
    const isActive = parent.is_active;

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <Link
                href="/institution-admin/parents"
                className="inline-flex items-center gap-1.5 rounded-input text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
                <ChevronLeft className="size-3.5" />
                {t('backParents')}
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
                        currentImageUrl={parent.avatar_url}
                        onUploadSuccess={handleAvatarUpload}
                        onError={(err) => toast.error(err)}
                        size={72}
                        className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
                                {parent.full_name}
                            </h1>
                            <Badge tone={isActive ? 'success' : 'danger'} dot>
                                {isActive ? t('active') : t('inactive')}
                            </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                            {t('contact')}:{' '}
                            {parent.phone_number || parent.email || t('unregistered')}
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

            <div className="grid gap-6 lg:grid-cols-3">
                {/* ── Linked children ───────────────────────────────────────── */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex-row items-center justify-between gap-3">
                        <CardTitle as="h2">{t('mappedChildren')}</CardTitle>
                        <Badge tone="neutral" variant="outline" size="sm">
                            {children.length}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        {children.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={<Users />}
                                title={t('noStudentsMapped')}
                                description={t('noStudentsMappedDesc')}
                            />
                        ) : (
                            <ul className="space-y-2.5">
                                {children.map((pc: any, idx: number) => (
                                    <motion.li
                                        key={pc.student_id}
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
                                                name={pc.students?.users?.full_name}
                                                src={pc.students?.users?.avatar_url}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-foreground">
                                                    {pc.students?.users?.full_name}
                                                </div>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                    <span className="numeric">
                                                        {t('admissionNo')}:{' '}
                                                        {pc.students?.admission_no}
                                                    </span>
                                                    <span aria-hidden>&middot;</span>
                                                    <span>
                                                        {titleCase(
                                                            pc.relationship ?? '',
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={t('unlink')}
                                            title={t('unlink')}
                                            className="text-destructive"
                                            onClick={() =>
                                                setUnlinkTarget({
                                                    studentId: pc.student_id,
                                                    name:
                                                        pc.students?.users?.full_name ??
                                                        '',
                                                })
                                            }
                                        >
                                            <Link2Off className="size-4" />
                                        </Button>
                                    </motion.li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* ── Contact details ───────────────────────────────────── */}
                    <Card>
                        <CardHeader className="flex-row items-center justify-between gap-3">
                            <CardTitle as="h2">{t('contactDetails')}</CardTitle>
                            {!isEditing ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    leadingIcon={<Edit2 />}
                                >
                                    {t('editProfile')}
                                </Button>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditing(false)}
                                        disabled={savingEdit}
                                    >
                                        {tc('cancel')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveEdit}
                                        loading={savingEdit}
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
                                            icon: <Mail className="size-3.5" />,
                                            label: t('emailAddress'),
                                            value: parent.email || t('na'),
                                        },
                                        {
                                            icon: <Phone className="size-3.5" />,
                                            label: t('mobileNumber'),
                                            value: parent.phone_number || t('na'),
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
                                    <Field
                                        label={t('fullName')}
                                        htmlFor="parent-edit-name"
                                    >
                                        <Input
                                            id="parent-edit-name"
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
                                    <Field
                                        label={t('emailAddress')}
                                        htmlFor="parent-edit-email"
                                    >
                                        <Input
                                            id="parent-edit-email"
                                            type="email"
                                            inputSize="sm"
                                            leadingIcon={<Mail />}
                                            value={editForm.email}
                                            onChange={(e) =>
                                                setEditForm({
                                                    ...editForm,
                                                    email: e.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <Field
                                        label={t('mobileNumber')}
                                        htmlFor="parent-edit-phone"
                                    >
                                        <Input
                                            id="parent-edit-phone"
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
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Link a student ────────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle as="h2">{t('linkStudent')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {availableStudents.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('noStudentsAvailable')}
                                </p>
                            ) : (
                                <form onSubmit={handleLink} className="space-y-4">
                                    <Field
                                        label={t('selectStudent')}
                                        htmlFor="link-student"
                                    >
                                        <Select
                                            id="link-student"
                                            required
                                            selectSize="sm"
                                            value={selectedStudentId}
                                            onChange={(e) =>
                                                setSelectedStudentId(e.target.value)
                                            }
                                        >
                                            <option value="" disabled>
                                                {t('chooseStudent')}
                                            </option>
                                            {availableStudents.map((student) => (
                                                <option
                                                    key={student.id}
                                                    value={student.id}
                                                >
                                                    {student.users?.full_name} (
                                                    {student.admission_no})
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>

                                    <Field
                                        label={t('relationshipContext')}
                                        htmlFor="link-relationship"
                                    >
                                        <Select
                                            id="link-relationship"
                                            selectSize="sm"
                                            value={relationship}
                                            onChange={(e) =>
                                                setRelationship(
                                                    e.target
                                                        .value as ParentRelationship,
                                                )
                                            }
                                        >
                                            {Object.values(ParentRelationship).map(
                                                (value) => (
                                                    <option key={value} value={value}>
                                                        {titleCase(value)}
                                                    </option>
                                                ),
                                            )}
                                        </Select>
                                    </Field>

                                    <Button
                                        type="submit"
                                        block
                                        loading={mapping}
                                        disabled={!selectedStudentId}
                                        leadingIcon={<Link2 />}
                                    >
                                        {mapping ? t('linking') : t('mapStudent')}
                                    </Button>
                                </form>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ConfirmDialog
                open={!!unlinkTarget}
                onClose={() => setUnlinkTarget(null)}
                onConfirm={confirmUnlink}
                title={t('unlinkTitle')}
                description={t('unlinkConfirm')}
                confirmLabel={t('unlink')}
                cancelLabel={t('cancel')}
                loading={unlinking}
                icon={<Link2Off />}
            />

            <AccountStatusDialog
                open={showStatusModal}
                onClose={() => setShowStatusModal(false)}
                isActive={isActive}
                name={parent.full_name}
                loading={actionLoading}
                onConfirm={confirmToggleStatus}
            />
        </div>
    );
}
