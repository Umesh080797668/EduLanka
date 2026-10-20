'use client';

import { useEffect, useState } from 'react';
import {
    Award,
    Calendar,
    Check,
    CheckCircle2,
    FileEdit,
    FileText,
    GraduationCap,
    Info,
    Plus,
    RefreshCw,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

interface HomeworkTask {
    id: string;
    class_id: string;
    subject: string;
    title: string;
    description: string;
    due_date: string;
    max_marks: number;
    created_at: string;
    classes?: { id: string; name: string; grade: number };
}

interface HomeworkSubmission {
    id: string;
    homework_id: string;
    student_id: string;
    submitted_at: string;
    content?: string;
    attachment_url?: string;
    marks?: number | null;
    feedback?: string | null;
    status: 'SUBMITTED' | 'GRADED' | 'LATE';
    students?: {
        id: string;
        admission_number: string;
        users?: { id: string; full_name: string; email: string };
    };
}

export default function TeacherHomeworkPage() {
    const t = useTranslations('Homework');
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
    const [tasks, setTasks] = useState<HomeworkTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime] = useState(() => Date.now());

    // Create Homework Modal state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createForm, setCreateForm] = useState({
        classId: '',
        subject: '',
        title: '',
        description: '',
        dueDate: '',
        maxMarks: 100,
    });

    // Submissions Review Modal state
    const [reviewTask, setReviewTask] = useState<HomeworkTask | null>(null);
    const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);
    const [gradingSubId, setGradingSubId] = useState<string | null>(null);
    const [gradingForm, setGradingForm] = useState<{ [subId: string]: { marks: number; feedback: string } }>({});
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    // 1. Initial data fetch: teacher classes & homework
    useEffect(() => {
        const init = async () => {
            try {
                const user = await apiClient.get<any>('/users/me');
                if (user?.id) {
                    const classList = await apiClient.get<any[]>(`/classes?teacherId=${user.id}`);
                    setClasses(classList || []);
                    if (classList && classList.length > 0) {
                        setCreateForm((prev) => ({ ...prev, classId: classList[0].id }));
                    }

                    const homeworkList = await apiClient.get<HomeworkTask[]>('/homework');
                    setTasks(homeworkList || []);
                }
            } catch (err: any) {
                console.error('Failed to load homework data:', err);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, []);

    // Filter tasks by selected class
    const filteredTasks = tasks.filter(
        (t) => selectedClassId === 'ALL' || t.class_id === selectedClassId,
    );

    // Handle Create Homework submission
    const handleCreateHomework = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);

        try {
            if (!createForm.classId || !createForm.subject || !createForm.title || !createForm.dueDate) {
                setCreateError('Please complete all required fields.');
                setCreating(false);
                return;
            }

            const created = await apiClient.post<HomeworkTask>('/homework', {
                classId: createForm.classId,
                subject: createForm.subject,
                title: createForm.title,
                description: createForm.description,
                dueDate: new Date(createForm.dueDate).toISOString(),
                maxMarks: Number(createForm.maxMarks) || 100,
            });

            setTasks((prev) => [created, ...prev]);
            setIsCreateOpen(false);
            setCreateForm({
                classId: classes[0]?.id || '',
                subject: '',
                title: '',
                description: '',
                dueDate: '',
                maxMarks: 100,
            });
        } catch (err: any) {
            console.error('Failed to create homework:', err);
            setCreateError(err?.message || 'Failed to create homework task');
        } finally {
            setCreating(false);
        }
    };

    // Open Submissions Review Drawer/Modal
    const openSubmissionsReview = async (task: HomeworkTask) => {
        setReviewTask(task);
        setLoadingSubmissions(true);
        setSaveStatus(null);
        try {
            const list = await apiClient.get<HomeworkSubmission[]>(
                `/homework/${task.id}/submissions`,
            );
            setSubmissions(list || []);

            // Pre-populate grading form state
            const initialGrading: any = {};
            (list || []).forEach((s) => {
                initialGrading[s.id] = {
                    marks: s.marks ?? 0,
                    feedback: s.feedback || '',
                };
            });
            setGradingForm(initialGrading);
        } catch (err: any) {
            console.error('Failed to load submissions:', err);
        } finally {
            setLoadingSubmissions(false);
        }
    };

    // Grade a specific submission
    const handleGradeSubmission = async (submissionId: string) => {
        const formData = gradingForm[submissionId];
        if (!formData) return;

        setGradingSubId(submissionId);
        setSaveStatus(null);

        try {
            const updated = await apiClient.patch<HomeworkSubmission>(
                `/homework/submissions/${submissionId}/grade`,
                {
                    marks: Number(formData.marks),
                    feedback: formData.feedback,
                },
            );

            setSubmissions((prev) =>
                prev.map((s) =>
                    s.id === submissionId
                        ? { ...s, marks: updated.marks, feedback: updated.feedback, status: 'GRADED' }
                        : s,
                ),
            );
            setSaveStatus('Grade and feedback saved successfully!');
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (err: any) {
            console.error('Failed to grade submission:', err);
            alert(err?.message || 'Failed to save grade');
        } finally {
            setGradingSubId(null);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <PageSkeleton />
            </div>
        );
    }

    return (
        <TutorialProvider role="TEACHER" screenId="homework">
            <div className="mx-auto max-w-6xl space-y-6">
                <PageHeader
                    icon={<FileEdit className="text-primary" />}
                    title={t('title')}
                    description={t('subtitle')}
                    badge={
                        tasks.length > 0 ? (
                            <Badge tone="primary">{tasks.length} {t('assignments')}</Badge>
                        ) : undefined
                    }
                />

                {/* Filter and Create Toolbar */}
                <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t('filterClass')}:
                        </label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="h-9 rounded-lg border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="ALL">{t('allAssignedClasses')}</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name || `Grade ${cls.grades?.level ?? cls.grade ?? ''} - ${cls.section ?? ''}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button
                        id="create-homework-btn"
                        variant="primary"
                        onClick={() => setIsCreateOpen(true)}
                        className="gap-2 shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        {t('assignHomework')}
                    </Button>
                </div>

                {/* Homework Task Grid */}
                {filteredTasks.length === 0 ? (
                    <EmptyState
                        icon={<FileText className="h-10 w-10 text-muted-foreground" />}
                        title={t('noHomeworkTitle')}
                        description={t('noHomeworkDescription')}
                        action={
                            <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                                {t('assignHomework')}
                            </Button>
                        }
                    />
                ) : (
                    <div id="homework-tasks-grid" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredTasks.map((task) => {
                            const dueDate = new Date(task.due_date);
                            const isPastDue = dueDate.getTime() < currentTime;

                            return (
                                <Card
                                    key={task.id}
                                    className="flex flex-col justify-between border border-border/70 transition-all hover:border-primary/40 hover:shadow-md"
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <Badge tone="neutral" className="text-xs font-semibold">
                                                {task.subject}
                                            </Badge>
                                            <Badge tone={isPastDue ? 'danger' : 'success'} className="text-xs">
                                                {isPastDue ? t('pastDue') : t('active')}
                                            </Badge>
                                        </div>
                                        <CardTitle className="mt-2 text-base font-bold leading-snug">
                                            {task.title}
                                        </CardTitle>
                                        <div className="text-xs font-medium text-muted-foreground">
                                            {task.classes?.name || t('classAssignment')}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="space-y-3 py-2 text-sm text-muted-foreground">
                                        <p className="line-clamp-2 text-xs leading-relaxed">
                                            {task.description || t('noDescription')}
                                        </p>

                                        <div className="space-y-1.5 border-t border-border/40 pt-2 text-xs">
                                            <div className="flex items-center gap-1.5 text-foreground/80">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{t('due')}: {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-foreground/80">
                                                <Award className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{t('maxMarks')}: {task.max_marks} {t('pts')}</span>
                                            </div>
                                        </div>
                                    </CardContent>

                                    <CardFooter className="border-t border-border/40 pt-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full gap-2 text-xs"
                                            onClick={() => openSubmissionsReview(task)}
                                        >
                                            <GraduationCap className="h-4 w-4 text-primary" />
                                            {t('reviewSubmissions')}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Create Homework Modal Dialog */}
                <Dialog
                    open={isCreateOpen}
                    onClose={() => setIsCreateOpen(false)}
                    title={t('createHomeworkTitle')}
                    description={t('createHomeworkSubtitle')}
                >
                    <form onSubmit={handleCreateHomework} className="space-y-4">
                        {createError && (
                            <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                                <Info className="h-4 w-4 shrink-0" />
                                <span>{createError}</span>
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold text-foreground">
                                {t('targetClass')} *
                            </label>
                            <select
                                required
                                value={createForm.classId}
                                onChange={(e) => setCreateForm({ ...createForm, classId: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {classes.map((cls) => (
                                    <option key={cls.id} value={cls.id}>
                                        {cls.name || `Grade ${cls.grades?.level ?? cls.grade ?? ''} - ${cls.section ?? ''}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-foreground">
                                    {t('subject')} *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Mathematics"
                                    value={createForm.subject}
                                    onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-foreground">
                                    {t('maxMarks')} *
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    max="1000"
                                    value={createForm.maxMarks}
                                    onChange={(e) => setCreateForm({ ...createForm, maxMarks: Number(e.target.value) })}
                                    className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">
                                {t('assignmentTitle')} *
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Chapter 4 Quadratic Equations Problem Set"
                                value={createForm.title}
                                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">
                                {t('dueDate')} *
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={createForm.dueDate}
                                onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-foreground">
                                {t('instructions')}
                            </label>
                            <textarea
                                rows={3}
                                placeholder="Detailed student instructions, exercises, and submission requirements..."
                                value={createForm.description}
                                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateOpen(false)}
                                disabled={creating}
                            >
                                {t('cancel')}
                            </Button>
                            <Button type="submit" variant="primary" disabled={creating} className="gap-2">
                                {creating && <RefreshCw className="h-4 w-4 animate-spin" />}
                                {t('publishAssignment')}
                            </Button>
                        </div>
                    </form>
                </Dialog>

                {/* Submissions Review Modal Dialog */}
                <Dialog
                    open={Boolean(reviewTask)}
                    onClose={() => setReviewTask(null)}
                    title={reviewTask ? `${t('submissionsFor')}: ${reviewTask.title}` : t('submissions')}
                    description={reviewTask ? `${t('class')}: ${reviewTask.classes?.name || reviewTask.subject} • ${t('maxMarks')}: ${reviewTask.max_marks}` : ''}
                >
                    <div className="space-y-4">
                        {saveStatus && (
                            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span>{saveStatus}</span>
                            </div>
                        )}

                        {loadingSubmissions ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <RefreshCw className="mx-auto h-6 w-6 animate-spin opacity-50" />
                                <p className="mt-2 text-xs">{t('loadingSubmissions')}</p>
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground">
                                <Users className="mx-auto h-8 w-8 opacity-30" />
                                <p className="mt-2 text-sm">{t('noSubmissionsYet')}</p>
                            </div>
                        ) : (
                            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                                {submissions.map((sub) => {
                                    const studentName =
                                        sub.students?.users?.full_name || t('studentSubmission');
                                    const admNo = sub.students?.admission_number || 'N/A';
                                    const subForm = gradingForm[sub.id] || { marks: 0, feedback: '' };
                                    const isSavingThis = gradingSubId === sub.id;

                                    return (
                                        <div
                                            key={sub.id}
                                            className="rounded-xl border border-border/70 bg-card p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-semibold text-foreground">
                                                        {studentName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {t('admNo')}: {admNo} • {new Date(sub.submitted_at).toLocaleDateString()} {new Date(sub.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                <Badge
                                                    tone={
                                                        sub.status === 'GRADED'
                                                            ? 'success'
                                                            : sub.status === 'LATE'
                                                                ? 'danger'
                                                                : 'warning'
                                                    }
                                                    className="text-xs"
                                                >
                                                    {sub.status}
                                                </Badge>
                                            </div>

                                            {sub.content && (
                                                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-foreground">
                                                    <div className="font-medium text-muted-foreground mb-1">
                                                        {t('studentNotes')}:
                                                    </div>
                                                    {sub.content}
                                                </div>
                                            )}

                                            {sub.attachment_url && (
                                                <div className="mt-2">
                                                    <a
                                                        href={sub.attachment_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        {t('viewAttachedSolution')}
                                                    </a>
                                                </div>
                                            )}

                                            {/* Inline Grading Form */}
                                            <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 sm:flex-row sm:items-center sm:gap-3">
                                                <div className="w-28 shrink-0">
                                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                        {t('marks')} (/{reviewTask?.max_marks || 100})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={reviewTask?.max_marks || 100}
                                                        value={subForm.marks}
                                                        onChange={(e) =>
                                                            setGradingForm({
                                                                ...gradingForm,
                                                                [sub.id]: {
                                                                    ...subForm,
                                                                    marks: Number(e.target.value),
                                                                },
                                                            })
                                                        }
                                                        className="mt-0.5 h-8 w-full rounded border border-border bg-card px-2 text-xs font-semibold"
                                                    />
                                                </div>

                                                <div className="flex-1">
                                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                        {t('teacherFeedback')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Feedback / corrections..."
                                                        value={subForm.feedback}
                                                        onChange={(e) =>
                                                            setGradingForm({
                                                                ...gradingForm,
                                                                [sub.id]: {
                                                                    ...subForm,
                                                                    feedback: e.target.value,
                                                                },
                                                            })
                                                        }
                                                        className="mt-0.5 h-8 w-full rounded border border-border bg-card px-2 text-xs"
                                                    />
                                                </div>

                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    disabled={isSavingThis}
                                                    onClick={() => handleGradeSubmission(sub.id)}
                                                    className="mt-3 gap-1.5 self-end sm:mt-4"
                                                >
                                                    {isSavingThis ? (
                                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <Check className="h-3.5 w-3.5" />
                                                    )}
                                                    {t('saveGrade')}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Dialog>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
