'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Megaphone,
  Send,
  CheckCircle2,
  Clock,
  PlusCircle,
  Archive,
  Trash2,
  Edit3,
  Users,
  ListFilter,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { sanitizeNoticeHtml } from '@/lib/sanitize-html';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form';
import { PageHeader, EmptyState } from '@/components/ui/Layout';
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog';

interface NoticeItem {
  id: string;
  author_id?: string;
  title: string;
  content_html: string;
  scope: 'UNIVERSAL' | 'SCHOOL_WIDE' | 'GRADE_LEVEL' | 'CLASS_SPECIFIC';
  target_grade?: number | null;
  target_class_id?: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  medium?: 'ENGLISH' | 'SINHALA' | 'TAMIL' | null;
  is_archived?: boolean;
  requires_acknowledgment?: boolean;
  created_at: string;
  author?: {
    full_name?: string;
    role?: string;
  };
  is_read?: boolean;
  is_acknowledged?: boolean;
  acknowledged_at?: string | null;
}

interface TeacherClass {
  id: string;
  name: string;
  grade: number;
}

interface AckDetails {
  noticeId: string;
  title: string;
  requiresAcknowledgment: boolean;
  totalReads: number;
  totalAcknowledged: number;
  acknowledgments: Array<{
    userId: string;
    fullName?: string;
    role?: string;
    readAt?: string;
    acknowledgedAt?: string;
  }>;
}

export default function UniversalNoticesPage() {
  const t = useTranslations('Notices');
  const tc = useTranslations('Common');
  const [role] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('role') || '' : ''
  );
  const [userId] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('userId') || '' : ''
  );
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterArchived, setFilterArchived] = useState(false);
  const [filterMedium, setFilterMedium] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'compose'>('list');

  // Teacher composer state
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [composerTitle, setComposerTitle] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [composerPriority, setComposerPriority] = useState('NORMAL');
  const [composerMedium, setComposerMedium] = useState('');
  const [composerRequiresAck, setComposerRequiresAck] = useState(false);
  const [submittingNotice, setSubmittingNotice] = useState(false);

  // Acknowledging state
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Edit state
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPriority, setEditPriority] = useState('NORMAL');
  const [editMedium, setEditMedium] = useState('');
  const [editRequiresAck, setEditRequiresAck] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Delete / Archive / Ack modal states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [ackNotice, setAckNotice] = useState<NoticeItem | null>(null);
  const [ackData, setAckData] = useState<AckDetails | null>(null);
  const [loadingAcks, setLoadingAcks] = useState(false);

  const isTeacher = role === 'TEACHER';
  const isAdmin = role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN';
  const canCompose = isTeacher || isAdmin;

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

    if (role === 'TEACHER') {
      apiClient
        .get<any>('/users/me')
        .then((me) => {
          if (isMounted && me?.id) {
            return apiClient.get<TeacherClass[]>(`/classes?teacherId=${me.id}`);
          }
          return [];
        })
        .then((classes) => {
          if (isMounted && Array.isArray(classes)) {
            setTeacherClasses(classes);
            if (classes.length > 0) setSelectedClassId(classes[0].id);
          }
        })
        .catch(() => {});
    }

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
  }, [role, t]);

  const handleAcknowledge = async (noticeId: string) => {
    setAcknowledgingId(noticeId);
    try {
      await apiClient.post(`/notices/${noticeId}/acknowledge`, {}, { skipGlobalToast: true });
      toast.success(t('acknowledged'));
      setNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId
            ? { ...n, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err: any) {
      toast.error(err?.message || t('ackFailed'));
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleTeacherCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toast.error('Please select a target class');
      return;
    }
    setSubmittingNotice(true);
    try {
      await apiClient.post(
        '/notices',
        {
          title: composerTitle,
          content_html: composerContent,
          scope: 'CLASS_SPECIFIC',
          target_class_id: selectedClassId,
          priority: composerPriority,
          medium: composerMedium || undefined,
          requires_acknowledgment: composerRequiresAck,
        },
        { skipGlobalToast: true }
      );
      toast.success(t('noticeCreatedSuccess'));
      setComposerTitle('');
      setComposerContent('');
      setComposerMedium('');
      setComposerRequiresAck(false);
      setActiveTab('list');
      void fetchNotices();
    } catch (err: any) {
      toast.error(err?.message || t('noticeCreateFailed'));
    } finally {
      setSubmittingNotice(false);
    }
  };

  const handleOpenEdit = (notice: NoticeItem) => {
    setEditingNotice(notice);
    setEditTitle(notice.title);
    setEditContent(notice.content_html);
    setEditPriority(notice.priority);
    setEditMedium(notice.medium || '');
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
          medium: editMedium || undefined,
          requires_acknowledgment: editRequiresAck,
        },
        { skipGlobalToast: true }
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

  const displayedNotices = notices.filter((n) => {
    const matchesArchive = filterArchived ? Boolean(n.is_archived) : !n.is_archived;
    const matchesMedium = !filterMedium || n.medium === filterMedium;
    return matchesArchive && matchesMedium;
  });

  return (
    <TutorialProvider role={(role as any) || 'STUDENT'} screenId="notices">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            icon={<Megaphone />}
            title={t('officialNotices')}
            description={t('latestNotices')}
          />

          {canCompose && (
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
                variant={activeTab === 'compose' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('compose')}
                leadingIcon={<PlusCircle />}
              >
                {t('teacherComposer')}
              </Button>
            </div>
          )}
        </div>

        {activeTab === 'list' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
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
                <div className="w-36">
                  <Select
                    selectSize="sm"
                    value={filterMedium}
                    onChange={(e) => setFilterMedium(e.target.value)}
                    aria-label={t('filterByMedium')}
                  >
                    <option value="">{t('allMediums')}</option>
                    <option value="SINHALA">{t('medium_SINHALA')}</option>
                    <option value="TAMIL">{t('medium_TAMIL')}</option>
                    <option value="ENGLISH">{t('medium_ENGLISH')}</option>
                  </Select>
                </div>
              </div>
              <span className="text-muted-foreground text-xs">
                {displayedNotices.length} notices
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-card bg-muted/40 h-32 animate-pulse" />
                ))}
              </div>
            ) : displayedNotices.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="size-8" />}
                title={t('noNotices')}
                description={
                  filterArchived
                    ? 'No archived notices found.'
                    : 'You have no new announcements at this time.'
                }
              />
            ) : (
              <div className="space-y-4">
                {displayedNotices.map((n) => {
                  const canManageNotice = isAdmin || (isTeacher && n.author_id === userId);
                  return (
                    <Card key={n.id} className="overflow-hidden transition-shadow hover:shadow-sm">
                      <CardHeader className="bg-muted/20 pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle as="h2" className="text-base font-semibold tracking-tight">
                              {n.title}
                            </CardTitle>
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
                            {n.medium && (
                              <Badge tone="neutral" size="sm" variant="outline">
                                {t(`medium_${n.medium}` as any)}
                              </Badge>
                            )}
                          </div>

                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <Clock className="size-3.5" />
                            <span>{new Date(n.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {n.author?.full_name && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {t('postedBy')}:{' '}
                            <span className="text-foreground font-medium">
                              {n.author.full_name}
                            </span>{' '}
                            ({n.author.role})
                          </p>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-4 pt-4">
                        <div
                          className="prose prose-sm dark:prose-invert text-foreground/90 max-w-none leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(n.content_html) }}
                        />

                        <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                          {/* Acknowledgment block */}
                          {n.requires_acknowledgment ? (
                            n.is_acknowledged ? (
                              <div className="text-success-600 dark:text-success-400 flex items-center gap-1.5 text-xs font-medium">
                                <CheckCircle2 className="size-4" />
                                <span>{t('acknowledged')}</span>
                                {n.acknowledged_at && (
                                  <span className="text-muted-foreground">
                                    ({new Date(n.acknowledged_at).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleAcknowledge(n.id)}
                                loading={acknowledgingId === n.id}
                                leadingIcon={<CheckCircle2 className="size-4" />}
                              >
                                {t('acknowledge')}
                              </Button>
                            )
                          ) : (
                            <div />
                          )}

                          {/* Management controls for author or admin */}
                          {canManageNotice && (
                            <div className="ml-auto flex items-center gap-1.5">
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
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Teacher / Admin Composer */
          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleTeacherCompose}
          >
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t('teacherComposer')}</CardTitle>
                <p className="text-muted-foreground text-sm">{t('teacherComposerDescription')}</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Field label={t('selectClass')} htmlFor="compose-class" required>
                  <Select
                    id="compose-class"
                    required
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                  >
                    {teacherClasses.length === 0 ? (
                      <option value="">{t('selectClassPlaceholder')}</option>
                    ) : (
                      teacherClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          Grade {cls.grade} - {cls.name}
                        </option>
                      ))
                    )}
                  </Select>
                </Field>

                <Field label={t('title')} htmlFor="compose-title" required>
                  <Input
                    id="compose-title"
                    required
                    value={composerTitle}
                    onChange={(e) => setComposerTitle(e.target.value)}
                    placeholder={t('titlePlaceholder')}
                  />
                </Field>

                <Field label={t('content')} htmlFor="compose-content" required>
                  <Textarea
                    id="compose-content"
                    required
                    rows={6}
                    value={composerContent}
                    onChange={(e) => setComposerContent(e.target.value)}
                    placeholder={t('contentPlaceholder')}
                  />
                </Field>

                <div className="rounded-card border-border bg-muted/30 grid gap-4 border p-4 sm:grid-cols-3">
                  <Field label={t('priority')} htmlFor="compose-priority">
                    <Select
                      id="compose-priority"
                      value={composerPriority}
                      onChange={(e) => setComposerPriority(e.target.value)}
                    >
                      <option value="LOW">{t('priority_LOW')}</option>
                      <option value="NORMAL">{t('priority_NORMAL')}</option>
                      <option value="HIGH">{t('priority_HIGH')}</option>
                      <option value="URGENT">{t('priority_URGENT')}</option>
                    </Select>
                  </Field>

                  <Field label={t('medium')} htmlFor="compose-medium">
                    <Select
                      id="compose-medium"
                      value={composerMedium}
                      onChange={(e) => setComposerMedium(e.target.value)}
                    >
                      <option value="">{t('allMediums')}</option>
                      <option value="SINHALA">{t('mediumSinhala')}</option>
                      <option value="TAMIL">{t('mediumTamil')}</option>
                      <option value="ENGLISH">{t('mediumEnglish')}</option>
                    </Select>
                  </Field>

                  <div className="flex items-center pt-6">
                    <Switch
                      id="compose-ack-toggle"
                      checked={composerRequiresAck}
                      onCheckedChange={setComposerRequiresAck}
                      label={t('requiresAckPrompt')}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setActiveTab('list')}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    loading={submittingNotice}
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

            <div className="grid gap-4 sm:grid-cols-3">
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

              <Field label={t('medium')} htmlFor="edit-notice-medium">
                <Select
                  id="edit-notice-medium"
                  value={editMedium}
                  onChange={(e) => setEditMedium(e.target.value)}
                >
                  <option value="">{t('allMediums')}</option>
                  <option value="SINHALA">{t('mediumSinhala')}</option>
                  <option value="TAMIL">{t('mediumTamil')}</option>
                  <option value="ENGLISH">{t('mediumEnglish')}</option>
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

            <div className="border-border flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditingNotice(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={updating}>
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
            <div className="text-muted-foreground animate-pulse py-8 text-center text-sm">
              Loading acknowledgment records...
            </div>
          ) : ackData ? (
            <div className="space-y-4 pt-2">
              <div className="rounded-card border-border bg-muted/30 grid grid-cols-2 gap-3 border p-3 text-center">
                <div>
                  <p className="text-muted-foreground text-xs">{t('totalReaders')}</p>
                  <p className="text-foreground text-lg font-bold">{ackData.totalReads}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">{t('totalAcknowledged')}</p>
                  <p className="text-success-600 dark:text-success-400 text-lg font-bold">
                    {ackData.totalAcknowledged}
                  </p>
                </div>
              </div>

              <div className="rounded-card border-border max-h-72 overflow-y-auto border">
                {ackData.acknowledgments.length === 0 ? (
                  <div className="text-muted-foreground p-4 text-center text-sm">
                    {t('noAcknowledgments')}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-border bg-muted/50 text-muted-foreground border-b font-semibold">
                      <tr>
                        <th className="p-2.5">User</th>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5">Read At</th>
                        <th className="p-2.5">Acknowledged At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {ackData.acknowledgments.map((a) => (
                        <tr key={a.userId}>
                          <td className="text-foreground p-2.5 font-medium">
                            {a.fullName || a.userId.slice(0, 8)}
                          </td>
                          <td className="p-2.5">
                            <Badge size="sm" variant="soft">
                              {a.role || 'USER'}
                            </Badge>
                          </td>
                          <td className="text-muted-foreground p-2.5">
                            {a.readAt ? new Date(a.readAt).toLocaleString() : '—'}
                          </td>
                          <td className="text-success-600 dark:text-success-400 p-2.5 font-medium">
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
