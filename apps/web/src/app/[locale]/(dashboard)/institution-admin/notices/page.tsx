'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Megaphone,
    Send,
    ListFilter,
    PlusCircle,
    Archive,
    Trash2,
    Edit3,
    CheckCircle2,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form';
import { PageHeader, EmptyState } from '@/components/ui/Layout';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';

interface NoticeItem {
    id: string;
    title: string;
    content_html: string;
    scope: 'UNIVERSAL' | 'SCHOOL_WIDE' | 'GRADE_LEVEL' | 'CLASS_SPECIFIC';
    target_grade?: number | null;
    target_class_id?: string | null;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    is_archived?: boolean;
    requires_acknowledgment?: boolean;
    created_at: string;
    author?: {
        full_name?: string;
        role?: string;
    };
    is_read?: boolean;
    is_acknowledged?: boolean;
}

interface AckRecord {
    userId: string;
    fullName?: string;
    role?: string;
    readAt?: string;
    acknowledgedAt?: string;
}

interface AckDetails {
    noticeId: string;
    title: string;
    requiresAcknowledgment: boolean;
    totalReads: number;
    totalAcknowledged: number;
    acknowledgments: AckRecord[];
}

export default function AdminNoticesPage() {
    const t = useTranslations('Notices');
    const tc = useTranslations('Common');
    const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
    const [notices, setNotices] = useState<NoticeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterArchived, setFilterArchived] = useState(false);

    // Create state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [scope, setScope] = useState('SCHOOL_WIDE');
    const [priority, setPriority] = useState('NORMAL');
    const [sendSms, setSendSms] = useState(false);
    const [requiresAck, setRequiresAck] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Edit state
    const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editPriority, setEditPriority] = useState('NORMAL');
    const [editRequiresAck, setEditRequiresAck] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Delete & Archive confirm states
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [archivingId, setArchivingId] = useState<string | null>(null);

    // Acknowledgments viewer state
    const [ackNotice, setAckNotice] = useState<NoticeItem | null>(null);
    const [ackData, setAckData] = useState<AckDetails | null>(null);
    const [loadingAcks, setLoadingAcks] = useState(false);

    const fetchNotices = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient.get<NoticeItem[]>('/notices?includeArchived=true', {
                skipGlobalToast: true,
            });
            if (Array.isArray(data)) {
                setNotices(data);
            }
        } catch {
            toast.error(t('loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            try {
                const data = await apiClient.get<NoticeItem[]>('/notices?includeArchived=true', {
                    skipGlobalToast: true,
                });
                if (isMounted && Array.isArray(data)) {
                    setNotices(data);
                }
            } catch {
                if (isMounted) toast.error(t('loadFailed'));
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        void loadInitial();
        return () => {
            isMounted = false;
        };
    }, [t]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await apiClient.post(
                '/notices',
                {
                    title,
                    content_html: content,
                    scope,
                    target_grade: scope === 'GRADE_LEVEL' ? targetGroupId : null,
                    target_class_id: scope === 'CLASS_SPECIFIC' ? targetGroupId : null,
                    priority,
                    send_sms: sendSms,
                    requires_acknowledgment: requiresAck,
                },
                { skipGlobalToast: true },
            );
            toast.success(t('noticeCreatedSuccess'));
            setTitle('');
            setContent('');
            setRequiresAck(false);
            setTargetGroupId('');
            setActiveTab('list');
            void fetchNotices();
        } catch (err: any) {
            toast.error(err?.message || t('noticeCreateFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEdit = (notice: NoticeItem) => {
        setEditingNotice(notice);
        setEditTitle(notice.title);
        setEditContent(notice.content_html);
        setEditPriority(notice.priority);
        setEditRequiresAck(Boolean(notice.requires_acknowledgment));
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingNotice) return;
        setUpdating(true);
        try {
            await apiClient.patch(
                `/notices/${editingNotice.id}`,
                {
                    title: editTitle,
                    content_html: editContent,
                    priority: editPriority,
                    requires_acknowledgment: editRequiresAck,
                },
                { skipGlobalToast: true },
            );
            toast.success(t('noticeUpdatedSuccess'));
            setEditingNotice(null);
            void fetchNotices();
        } catch (err: any) {
            toast.error(err?.message || 'Update failed');
        } finally {
            setUpdating(false);
        }
    };

    const handleArchive = async () => {
        if (!archivingId) return;
        try {
            await apiClient.patch(`/notices/${archivingId}/archive`, {}, { skipGlobalToast: true });
            toast.success(t('noticeArchivedSuccess'));
            setArchivingId(null);
            void fetchNotices();
        } catch (err: any) {
            toast.error(err?.message || 'Archive failed');
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await apiClient.delete(`/notices/${deletingId}`, { skipGlobalToast: true });
            toast.success(t('noticeDeletedSuccess'));
            setDeletingId(null);
            void fetchNotices();
        } catch (err: any) {
            toast.error(err?.message || 'Delete failed');
        }
    };

    const handleViewAcks = async (notice: NoticeItem) => {
        setAckNotice(notice);
        setLoadingAcks(true);
        setAckData(null);
        try {
            const data = await apiClient.get<AckDetails>(`/notices/${notice.id}/acknowledgments`, {
                skipGlobalToast: true,
            });
            setAckData(data);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to load acknowledgments');
        } finally {
            setLoadingAcks(false);
        }
    };

    const displayedNotices = notices.filter((n) => (filterArchived ? Boolean(n.is_archived) : !n.is_archived));

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="notices">
            <div className="mx-auto max-w-5xl space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <PageHeader
                        icon={<Megaphone />}
                        title={t('manageNotices')}
                        description={t('manageNoticesDescription')}
                    />
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant={activeTab === 'list' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('list')}
                            leadingIcon={<ListFilter />}
                        >
                            {t('allNotices')}
                        </Button>
                        <Button
                            type="button"
                            variant={activeTab === 'create' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('create')}
                            leadingIcon={<PlusCircle />}
                        >
                            {t('createNotice')}
                        </Button>
                    </div>
                </div>

                {activeTab === 'list' ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant={!filterArchived ? 'primary' : 'secondary'}
                                    onClick={() => setFilterArchived(false)}
                                >
                                    {t('activeNotices')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant={filterArchived ? 'primary' : 'secondary'}
                                    onClick={() => setFilterArchived(true)}
                                >
                                    {t('archivedNotices')}
                                </Button>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {displayedNotices.length} items
                            </span>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-28 animate-pulse rounded-card bg-muted/40" />
                                ))}
                            </div>
                        ) : displayedNotices.length === 0 ? (
                            <EmptyState
                                icon={<Megaphone className="size-8" />}
                                title={t('noNotices')}
                                description={filterArchived ? 'No archived notices.' : 'Create an announcement to keep students and staff informed.'}
                            />
                        ) : (
                            <div className="space-y-3">
                                {displayedNotices.map((n) => (
                                    <Card key={n.id} className="transition-shadow hover:shadow-sm">
                                        <CardContent className="p-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="space-y-1.5 flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-semibold text-foreground text-base tracking-tight truncate">
                                                            {n.title}
                                                        </h3>
                                                        <Badge
                                                            tone={
                                                                n.priority === 'URGENT'
                                                                    ? 'danger'
                                                                    : n.priority === 'HIGH'
                                                                    ? 'warning'
                                                                    : 'neutral'
                                                            }
                                                            size="sm"
                                                        >
                                                            {t(`priority_${n.priority}` as any)}
                                                        </Badge>
                                                        <Badge tone="info" size="sm" variant="outline">
                                                            {t(`scope_${n.scope}` as any)}
                                                        </Badge>
                                                        {n.requires_acknowledgment && (
                                                            <Badge tone="primary" size="sm" variant="soft">
                                                                <CheckCircle2 className="size-3 mr-1 inline" />
                                                                {t('requiresAck')}
                                                            </Badge>
                                                        )}
                                                        {n.is_archived && (
                                                            <Badge tone="neutral" size="sm">
                                                                {t('archived')}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                                                        {n.author?.full_name && (
                                                            <span>{t('postedBy')}: {n.author.full_name}</span>
                                                        )}
                                                        <span>•</span>
                                                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                                    </p>

                                                    <p className="text-sm text-foreground/85 line-clamp-2 mt-1">
                                                        {n.content_html.replace(/<[^>]*>?/gm, '')}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-1.5 sm:self-center">
                                                    {n.requires_acknowledgment && (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => handleViewAcks(n)}
                                                            leadingIcon={<Users className="size-3.5" />}
                                                        >
                                                            {t('viewAcknowledgments')}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleOpenEdit(n)}
                                                        leadingIcon={<Edit3 className="size-3.5" />}
                                                    >
                                                        {t('editNotice')}
                                                    </Button>
                                                    {!n.is_archived && (
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => setArchivingId(n.id)}
                                                            leadingIcon={<Archive className="size-3.5" />}
                                                        >
                                                            {t('archive')}
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => setDeletingId(n.id)}
                                                        leadingIcon={<Trash2 className="size-3.5" />}
                                                    >
                                                        {t('delete')}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <motion.form
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        onSubmit={handleCreate}
                    >
                        <Card>
                            <CardContent className="space-y-6 pt-6">
                                <Field label={t('title')} htmlFor="notice-title" required>
                                    <Input
                                        id="notice-title"
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={t('titlePlaceholder')}
                                    />
                                </Field>

                                <Field label={t('content')} htmlFor="notice-content" required>
                                    <Textarea
                                        id="notice-content"
                                        required
                                        rows={6}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder={t('contentPlaceholder')}
                                    />
                                </Field>

                                {/* ── Targeting ─────────────────────────────────────── */}
                                <div className="grid gap-4 rounded-card border border-border bg-muted/40 p-4 sm:grid-cols-2">
                                    <Field label={t('scope')} htmlFor="notice-scope">
                                        <Select
                                            id="notice-scope"
                                            value={scope}
                                            onChange={(e) => setScope(e.target.value)}
                                        >
                                            <option value="SCHOOL_WIDE">{t('scope_SCHOOL_WIDE')}</option>
                                            <option value="GRADE_LEVEL">{t('scope_GRADE_LEVEL')}</option>
                                            <option value="CLASS_SPECIFIC">{t('scope_CLASS_SPECIFIC')}</option>
                                        </Select>
                                    </Field>

                                    <Field label={t('priority')} htmlFor="notice-priority">
                                        <Select
                                            id="notice-priority"
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value)}
                                        >
                                            <option value="LOW">{t('priority_LOW')}</option>
                                            <option value="NORMAL">{t('priority_NORMAL')}</option>
                                            <option value="HIGH">{t('priority_HIGH')}</option>
                                            <option value="URGENT">{t('priority_URGENT')}</option>
                                        </Select>
                                    </Field>

                                    {scope !== 'SCHOOL_WIDE' && (
                                        <div className="sm:col-span-2">
                                            <Field label={t('targetId')} htmlFor="notice-target" required>
                                                <Input
                                                    id="notice-target"
                                                    required
                                                    value={targetGroupId}
                                                    onChange={(e) => setTargetGroupId(e.target.value)}
                                                    placeholder={t('targetIdPlaceholder')}
                                                />
                                            </Field>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 rounded-card border border-border p-4">
                                    <Switch
                                        id="notice-ack-toggle"
                                        checked={requiresAck}
                                        onCheckedChange={setRequiresAck}
                                        label={t('requiresAckPrompt')}
                                        hint={t('requiresAckDescription')}
                                    />

                                    <Switch
                                        id="notice-sms-toggle"
                                        checked={sendSms}
                                        onCheckedChange={setSendSms}
                                        label={t('sendSmsPrompt')}
                                        hint={t('sendSmsDescription')}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setActiveTab('list')}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="lg"
                                        loading={submitting}
                                        leadingIcon={<Send />}
                                        className="flex-1"
                                    >
                                        {t('publishNotice')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.form>
                )}

                {/* Edit Modal */}
                <Dialog
                    open={Boolean(editingNotice)}
                    onClose={() => setEditingNotice(null)}
                    title={t('editNotice')}
                    icon={<Edit3 className="size-5" />}
                    size="lg"
                >
                    <form onSubmit={handleUpdate} className="space-y-4 pt-2">
                        <Field label={t('title')} htmlFor="edit-notice-title" required>
                            <Input
                                id="edit-notice-title"
                                required
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                            />
                        </Field>

                        <Field label={t('content')} htmlFor="edit-notice-content" required>
                            <Textarea
                                id="edit-notice-content"
                                required
                                rows={6}
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                            />
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={t('priority')} htmlFor="edit-notice-priority">
                                <Select
                                    id="edit-notice-priority"
                                    value={editPriority}
                                    onChange={(e) => setEditPriority(e.target.value)}
                                >
                                    <option value="LOW">{t('priority_LOW')}</option>
                                    <option value="NORMAL">{t('priority_NORMAL')}</option>
                                    <option value="HIGH">{t('priority_HIGH')}</option>
                                    <option value="URGENT">{t('priority_URGENT')}</option>
                                </Select>
                            </Field>

                            <div className="flex items-center pt-6">
                                <Switch
                                    id="edit-notice-ack-toggle"
                                    checked={editRequiresAck}
                                    onCheckedChange={setEditRequiresAck}
                                    label={t('requiresAckPrompt')}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t border-border">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setEditingNotice(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={updating}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Dialog>

                {/* Confirm Delete Dialog */}
                <ConfirmDialog
                    open={Boolean(deletingId)}
                    onClose={() => setDeletingId(null)}
                    onConfirm={handleDelete}
                    title={t('delete')}
                    description={t('deleteNoticeConfirm')}
                    confirmLabel={t('delete')}
                    cancelLabel={tc('cancel')}
                    tone="danger"
                />

                {/* Confirm Archive Dialog */}
                <ConfirmDialog
                    open={Boolean(archivingId)}
                    onClose={() => setArchivingId(null)}
                    onConfirm={handleArchive}
                    title={t('archive')}
                    description={t('archiveNoticeConfirm')}
                    confirmLabel={t('archive')}
                    cancelLabel={tc('cancel')}
                    tone="warning"
                />

                {/* Acknowledgments Inspector Dialog */}
                <Dialog
                    open={Boolean(ackNotice)}
                    onClose={() => setAckNotice(null)}
                    title={t('acknowledgmentsTitle')}
                    description={ackNotice?.title}
                    icon={<Users className="size-5" />}
                    size="lg"
                >
                    {loadingAcks ? (
                        <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
                            Loading acknowledgment records...
                        </div>
                    ) : ackData ? (
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3 rounded-card border border-border bg-muted/30 p-3 text-center">
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('totalReaders')}</p>
                                    <p className="text-lg font-bold text-foreground">{ackData.totalReads}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{t('totalAcknowledged')}</p>
                                    <p className="text-lg font-bold text-success-600 dark:text-success-400">
                                        {ackData.totalAcknowledged}
                                    </p>
                                </div>
                            </div>

                            <div className="max-h-72 overflow-y-auto rounded-card border border-border">
                                {ackData.acknowledgments.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        {t('noAcknowledgments')}
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
                                            <tr>
                                                <th className="p-2.5">User</th>
                                                <th className="p-2.5">Role</th>
                                                <th className="p-2.5">Read At</th>
                                                <th className="p-2.5">Acknowledged At</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {ackData.acknowledgments.map((a) => (
                                                <tr key={a.userId}>
                                                    <td className="p-2.5 font-medium text-foreground">
                                                        {a.fullName || a.userId.slice(0, 8)}
                                                    </td>
                                                    <td className="p-2.5">
                                                        <Badge size="sm" variant="soft">
                                                            {a.role || 'USER'}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-2.5 text-muted-foreground">
                                                        {a.readAt ? new Date(a.readAt).toLocaleString() : '—'}
                                                    </td>
                                                    <td className="p-2.5 text-success-600 dark:text-success-400 font-medium">
                                                        {a.acknowledgedAt ? new Date(a.acknowledgedAt).toLocaleString() : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    ) : null}
                </Dialog>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
