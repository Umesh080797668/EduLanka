'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Calendar,
    Clock,
    FileEdit,
    CheckCircle2,
    AlertCircle,
    Send,
    Award,
    BookOpen,
    Filter,
    Search,
    ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

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
}

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
    mySubmission?: HomeworkSubmission | null;
}

export default function StudentHomeworkPage() {
    const [tasks, setTasks] = useState<HomeworkTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'submitted' | 'all'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');

    // Submission modal state
    const [submittingTask, setSubmittingTask] = useState<HomeworkTask | null>(null);
    const [submissionContent, setSubmissionContent] = useState('');
    const [attachmentUrl, setAttachmentUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Detail/feedback modal state
    const [viewingTask, setViewingTask] = useState<HomeworkTask | null>(null);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const data = await apiClient.get<HomeworkTask[]>('/homework');
            setTasks(data || []);
        } catch (err: any) {
            toast.error('Failed to load homework assignments', {
                description: err?.message || 'Please check your connection and try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    // Extract unique subjects
    const subjects = useMemo(() => {
        const set = new Set<string>();
        tasks.forEach((t) => {
            if (t.subject) set.add(t.subject);
        });
        return Array.from(set).sort();
    }, [tasks]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const isSubmitted = Boolean(task.mySubmission);

            if (activeTab === 'pending' && isSubmitted) return false;
            if (activeTab === 'submitted' && !isSubmitted) return false;

            if (selectedSubject !== 'all' && task.subject !== selectedSubject) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = task.title?.toLowerCase().includes(q);
                const matchDesc = task.description?.toLowerCase().includes(q);
                const matchSubj = task.subject?.toLowerCase().includes(q);
                if (!matchTitle && !matchDesc && !matchSubj) return false;
            }

            return true;
        });
    }, [tasks, activeTab, selectedSubject, searchQuery]);

    const handleSubmitSolution = async () => {
        if (!submittingTask) return;
        if (!submissionContent.trim() && !attachmentUrl.trim()) {
            toast.error('Please enter submission content or provide an attachment URL');
            return;
        }

        try {
            setIsSubmitting(true);
            await apiClient.post(`/homework/${submittingTask.id}/submit`, {
                content: submissionContent.trim() || undefined,
                attachment_url: attachmentUrl.trim() || undefined,
            });

            toast.success('Homework submitted successfully!', {
                description: 'Your teacher has been notified of your submission.',
            });

            setSubmittingTask(null);
            setSubmissionContent('');
            setAttachmentUrl('');
            await fetchTasks();
        } catch (err: any) {
            toast.error('Failed to submit homework', {
                description: err?.message || 'An error occurred during submission.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDueBadge = (dueDateStr: string, isSubmitted: boolean) => {
        if (isSubmitted) {
            return (
                <Badge variant="soft" tone="success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Submitted
                </Badge>
            );
        }

        const due = new Date(dueDateStr).getTime();
        const now = Date.now();
        const diffHours = (due - now) / (1000 * 60 * 60);

        if (diffHours < 0) {
            return (
                <Badge variant="soft" tone="danger">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Overdue
                </Badge>
            );
        }
        if (diffHours < 24) {
            return (
                <Badge variant="soft" tone="warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Due Today
                </Badge>
            );
        }
        if (diffHours < 72) {
            return (
                <Badge variant="soft" tone="info">
                    <Calendar className="w-3 h-3 mr-1" />
                    Due Soon
                </Badge>
            );
        }

        return (
            <Badge variant="soft" tone="neutral">
                <Calendar className="w-3 h-3 mr-1" />
                {new Date(dueDateStr).toLocaleDateString()}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <PageSkeleton />
            </div>
        );
    }

    const pendingCount = tasks.filter((t) => !t.mySubmission).length;
    const submittedCount = tasks.filter((t) => Boolean(t.mySubmission)).length;

    return (
        <TutorialProvider role="STUDENT" screenId="student_homework">
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <PageHeader
                        title="My Homework & Tasks"
                        description="View assignments from your teachers, submit your work online, and review grades & feedback."
                        action={<HelpButton />}
                    />
                </div>

                {/* Filters & Tabs */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
                    {/* Tabs */}
                    <div id="student_homework_tabs" className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setActiveTab('pending')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'pending'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Pending ({pendingCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('submitted')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'submitted'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Submitted ({submittedCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'all'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            All ({tasks.length})
                        </button>
                    </div>

                    {/* Search & Subject Filter */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {subjects.length > 0 && (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
                                <select
                                    value={selectedSubject}
                                    onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="all">All Subjects</option>
                                    {subjects.map((subj) => (
                                        <option key={subj} value={subj}>
                                            {subj}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tasks Grid */}
                <div id="homework_task_list" className="space-y-4">
                    {filteredTasks.length === 0 ? (
                        <EmptyState
                            icon={<FileEdit className="size-8 text-muted-foreground" />}
                            title={
                                activeTab === 'pending'
                                    ? 'No pending homework!'
                                    : activeTab === 'submitted'
                                        ? 'No submitted homework yet'
                                        : 'No homework tasks found'
                            }
                            description={
                                activeTab === 'pending'
                                    ? 'You have completed all assigned tasks. Great job!'
                                    : 'When your teachers assign homework, it will appear here.'
                            }
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredTasks.map((task) => {
                                const submission = task.mySubmission;
                                const isSubmitted = Boolean(submission);
                                const isGraded = submission?.marks !== null && submission?.marks !== undefined;

                                return (
                                    <Card
                                        key={task.id}
                                        className="flex flex-col justify-between border hover:border-primary/50 transition-all duration-200 hover:shadow-md"
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="soft" tone="primary" className="font-medium">
                                                        <BookOpen className="w-3 h-3 mr-1" />
                                                        {task.subject}
                                                    </Badge>
                                                    {task.classes?.name && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {task.classes.name}
                                                        </span>
                                                    )}
                                                </div>
                                                {getDueBadge(task.due_date, isSubmitted)}
                                            </div>
                                            <CardTitle className="text-lg font-semibold mt-2 line-clamp-2">
                                                {task.title}
                                            </CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <Award className="w-3.5 h-3.5" />
                                                Max Marks: {task.max_marks} pts
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent className="py-2 flex-1">
                                            <p className="text-sm text-muted-foreground line-clamp-3">
                                                {task.description || 'No additional instructions provided.'}
                                            </p>

                                            {isSubmitted && (
                                                <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50 text-xs space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Submitted:</span>
                                                        <span className="font-medium text-foreground">
                                                            {new Date(submission!.submitted_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-muted-foreground">Status:</span>
                                                        {isGraded ? (
                                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                Graded: {submission!.marks} / {task.max_marks} pts
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                                Under Teacher Review
                                                            </span>
                                                        )}
                                                    </div>
                                                    {submission?.feedback && (
                                                        <div className="pt-1 text-muted-foreground border-t border-border/40">
                                                            <span className="font-medium text-foreground">Feedback: </span>
                                                            <span className="italic">{submission.feedback}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>

                                        <CardFooter className="pt-3 border-t bg-muted/20 flex items-center justify-between">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setViewingTask(task)}
                                                className="text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                View Details
                                            </Button>

                                            {isSubmitted ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setViewingTask(task)}
                                                    className="text-xs"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                                    View Submission
                                                </Button>
                                            ) : (
                                                <Button
                                                    id="submit_homework_btn"
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSubmittingTask(task);
                                                        setSubmissionContent('');
                                                        setAttachmentUrl('');
                                                    }}
                                                    className="text-xs"
                                                >
                                                    <Send className="w-3.5 h-3.5 mr-1" />
                                                    Submit Homework
                                                </Button>
                                            )}
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Submit Solution Dialog */}
                {submittingTask && (
                    <Dialog
                        open={Boolean(submittingTask)}
                        onClose={() => setSubmittingTask(null)}
                        title={`Submit Homework: ${submittingTask.title}`}
                    >
                        <div className="space-y-4 pt-2">
                            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Subject:</span>
                                    <span className="font-medium">{submittingTask.subject}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Due Date:</span>
                                    <span className="font-medium">
                                        {new Date(submittingTask.due_date).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Maximum Points:</span>
                                    <span className="font-medium">{submittingTask.max_marks} pts</span>
                                </div>
                                {submittingTask.description && (
                                    <div className="pt-2 border-t mt-2">
                                        <p className="font-medium text-foreground mb-1">Task Instructions:</p>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{submittingTask.description}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Your Solution Notes / Content</label>
                                <textarea
                                    rows={4}
                                    placeholder="Type your answer, solution steps, or comments for your teacher..."
                                    value={submissionContent}
                                    onChange={(e) => setSubmissionContent(e.target.value)}
                                    className="w-full p-3 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Attachment / Document URL (Optional)</label>
                                <input
                                    type="url"
                                    placeholder="https://... (Link to your Google Drive, PDF, or uploaded document)"
                                    value={attachmentUrl}
                                    onChange={(e) => setAttachmentUrl(e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <p className="text-xs text-muted-foreground">
                                    You can provide a secure cloud drive link or document URL with your completed work.
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setSubmittingTask(null)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleSubmitSolution}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                )}

                {/* View Details / Submission Modal */}
                {viewingTask && (
                    <Dialog
                        open={Boolean(viewingTask)}
                        onClose={() => setViewingTask(null)}
                        title={viewingTask.title}
                    >
                        <div className="space-y-4 pt-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="soft" tone="primary">{viewingTask.subject}</Badge>
                                {viewingTask.classes?.name && (
                                    <Badge variant="outline" tone="neutral">{viewingTask.classes.name}</Badge>
                                )}
                                <Badge variant="outline" tone="neutral">Max {viewingTask.max_marks} pts</Badge>
                                {getDueBadge(viewingTask.due_date, Boolean(viewingTask.mySubmission))}
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold mb-1">Instructions:</h4>
                                <div className="p-3 bg-muted/50 rounded-lg border text-sm text-muted-foreground whitespace-pre-wrap">
                                    {viewingTask.description || 'No instructions provided.'}
                                </div>
                            </div>

                            {viewingTask.mySubmission && (
                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="text-sm font-semibold flex items-center gap-1.5 text-primary">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            Your Submission
                                        </h4>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(viewingTask.mySubmission.submitted_at).toLocaleString()}
                                        </span>
                                    </div>

                                    {viewingTask.mySubmission.content && (
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium mb-1">Solution Notes:</p>
                                            <p className="text-sm whitespace-pre-wrap bg-background p-3 rounded-lg border">
                                                {viewingTask.mySubmission.content}
                                            </p>
                                        </div>
                                    )}

                                    {viewingTask.mySubmission.attachment_url && (
                                        <div>
                                            <a
                                                href={viewingTask.mySubmission.attachment_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                View Attached Document
                                            </a>
                                        </div>
                                    )}

                                    {viewingTask.mySubmission.marks !== null && viewingTask.mySubmission.marks !== undefined && (
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                                    Grade Awarded:
                                                </span>
                                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                    {viewingTask.mySubmission.marks} / {viewingTask.max_marks} pts
                                                </span>
                                            </div>
                                            {viewingTask.mySubmission.feedback && (
                                                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                                                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                                                        Teacher Feedback:
                                                    </p>
                                                    <p className="text-sm text-emerald-800 dark:text-emerald-300 italic mt-0.5">
                                                        &ldquo;{viewingTask.mySubmission.feedback}&rdquo;
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                {!viewingTask.mySubmission && (
                                    <Button
                                        variant="primary"
                                        onClick={() => {
                                            const t = viewingTask;
                                            setViewingTask(null);
                                            setSubmittingTask(t);
                                            setSubmissionContent('');
                                            setAttachmentUrl('');
                                        }}
                                    >
                                        <Send className="w-4 h-4 mr-1.5" />
                                        Submit Solution
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setViewingTask(null)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </Dialog>
                )}
            </div>
        </TutorialProvider>
    );
}
