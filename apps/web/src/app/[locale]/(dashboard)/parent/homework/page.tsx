'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    Award,
    Search,
    ExternalLink,
    Paperclip,
    Users,
    ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { EmptyState, PageHeader } from '@/components/ui/Layout';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

interface ChildSubmission {
    id: string;
    homework_id: string;
    student_id: string;
    studentName?: string;
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
    attachments?: string[];
    classes?: { id: string; name: string; grade: number };
    childSubmissions?: ChildSubmission[];
}

interface Child {
    id: string;
    name: string;
    grade?: string;
}

export default function ParentHomeworkPage() {
    const [tasks, setTasks] = useState<HomeworkTask[]>([]);
    const [children, setChildren] = useState<Child[]>([]);
    const [selectedChildId, setSelectedChildId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<HomeworkTask | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                // 1. Fetch parent's children
                const pRes = await apiClient.get<{ children: Child[] }>('/parents/me');
                setChildren(pRes.children || []);

                // 2. Fetch homework tasks
                const hRes = await apiClient.get<HomeworkTask[]>('/homework');
                setTasks(hRes || []);
            } catch (err: any) {
                console.error('Failed to load parent homework tasks:', err);
                toast.error(err?.message || 'Could not load homework assignments');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            // Search query filter
            if (
                searchQuery &&
                !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !task.subject?.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !task.classes?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            ) {
                return false;
            }

            const subs = task.childSubmissions || [];

            // Child filter
            if (selectedChildId !== 'all') {
                const childMatches = subs.some(
                    (s) => s.student_id === selectedChildId || s.studentName === children.find((c) => c.id === selectedChildId)?.name,
                );
                // If homework is assigned to child's class, keep it; else check if child submitted
                if (!childMatches && subs.length > 0) return false;
            }

            // Status filter
            if (statusFilter === 'graded') {
                return subs.some((s) => s.status === 'GRADED');
            } else if (statusFilter === 'submitted') {
                return subs.some((s) => s.status === 'SUBMITTED' || s.status === 'LATE');
            } else if (statusFilter === 'pending') {
                return subs.length === 0;
            }

            return true;
        });
    }, [tasks, searchQuery, selectedChildId, statusFilter, children]);

    if (loading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <PageSkeleton />
            </div>
        );
    }

    return (
        <TutorialProvider role="PARENT" screenId="parent_homework">
            <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <PageHeader
                        title="Children's Homework"
                        description="Review assignments assigned to your children, monitor submission timelines, and view teacher feedback."
                    />
                    <div className="flex items-center gap-2">
                        <HelpButton />
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <Card className="border border-border/60 shadow-sm bg-card/50 backdrop-blur-md p-4">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by title, subject, or class..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* Status Pills */}
                        <div className="flex flex-wrap items-center gap-2">
                            {(['all', 'pending', 'submitted', 'graded'] as const).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${statusFilter === st
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    {st === 'all' ? 'All Tasks' : st}
                                </button>
                            ))}
                        </div>

                        {/* Children Selector if multiple */}
                        {children.length > 1 && (
                            <div className="flex items-center gap-2 text-xs">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <select
                                    value={selectedChildId}
                                    onChange={(e) => setSelectedChildId(e.target.value)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                                >
                                    <option value="all">All Children</option>
                                    {children.map((child) => (
                                        <option key={child.id} value={child.id}>
                                            {child.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Homework Cards Grid */}
                {filteredTasks.length === 0 ? (
                    <div className="py-12">
                        <EmptyState
                            title="No Homework Tasks Found"
                            description="No assignments currently match your selected filters or search terms."
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTasks.map((task) => {
                            const isOverdue = new Date(task.due_date) < new Date();
                            const subs = task.childSubmissions || [];
                            const hasGraded = subs.some((s) => s.status === 'GRADED');
                            const hasSubmitted = subs.some((s) => s.status === 'SUBMITTED' || s.status === 'LATE');

                            return (
                                <motion.div
                                    key={task.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Card
                                        onClick={() => setSelectedTask(task)}
                                        className="h-full flex flex-col justify-between border border-border/70 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card/70 group"
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <Badge tone="primary" className="text-[11px] font-semibold">
                                                    {task.classes?.name || `Grade ${task.classes?.grade || 'General'}`}
                                                </Badge>
                                                {hasGraded ? (
                                                    <Badge tone="success" className="gap-1 text-[11px]">
                                                        <Award className="w-3 h-3 text-emerald-500" />
                                                        <span>Graded</span>
                                                    </Badge>
                                                ) : hasSubmitted ? (
                                                    <Badge tone="info" className="gap-1 text-[11px]">
                                                        <CheckCircle2 className="w-3 h-3 text-sky-500" />
                                                        <span>Submitted</span>
                                                    </Badge>
                                                ) : isOverdue ? (
                                                    <Badge tone="danger" className="gap-1 text-[11px]">
                                                        <AlertCircle className="w-3 h-3 text-rose-500" />
                                                        <span>Overdue</span>
                                                    </Badge>
                                                ) : (
                                                    <Badge tone="warning" className="gap-1 text-[11px]">
                                                        <Clock className="w-3 h-3 text-amber-500" />
                                                        <span>Pending</span>
                                                    </Badge>
                                                )}
                                            </div>

                                            <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-primary transition-colors">
                                                {task.title}
                                            </CardTitle>
                                            <CardDescription className="text-xs line-clamp-2 mt-1">
                                                {task.description}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent className="space-y-3 pb-4">
                                            {/* Due Date & Marks */}
                                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                                                </div>
                                                {task.max_marks > 0 && (
                                                    <span className="font-medium text-foreground">
                                                        Max {task.max_marks} pts
                                                    </span>
                                                )}
                                            </div>

                                            {/* Child Submissions Summary */}
                                            {subs.length > 0 && (
                                                <div className="bg-muted/40 rounded-lg p-2.5 space-y-1.5 border border-border/30">
                                                    {subs.map((s) => (
                                                        <div
                                                            key={s.id}
                                                            className="flex items-center justify-between text-xs"
                                                        >
                                                            <span className="font-semibold text-foreground">
                                                                {s.studentName || 'Child'}:
                                                            </span>
                                                            {s.status === 'GRADED' ? (
                                                                <span className="text-emerald-600 font-bold">
                                                                    Score: {s.marks ?? 0}/{task.max_marks}
                                                                </span>
                                                            ) : (
                                                                <span className="text-sky-600 font-medium">
                                                                    Turned In
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>

                                        <CardFooter className="pt-0 pb-4 text-xs font-semibold text-primary flex items-center justify-between">
                                            <span>View Details & Feedback</span>
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                )}

                {/* Detail Dialog */}
                {selectedTask && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <Card className="w-full max-w-2xl border border-border shadow-2xl bg-card overflow-hidden">
                            <CardHeader className="border-b border-border/40 pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge tone="primary">
                                            {selectedTask.classes?.name || `Grade ${selectedTask.classes?.grade || 'General'}`}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            Due: {new Date(selectedTask.due_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedTask(null)}
                                        className="h-8 w-8 p-0"
                                    >
                                        ✕
                                    </Button>
                                </div>
                                <CardTitle className="text-xl font-bold mt-2">
                                    {selectedTask.title}
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-6 pt-6 max-h-[70vh] overflow-y-auto">
                                <div>
                                    <h4 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">
                                        Assignment Instructions
                                    </h4>
                                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                        {selectedTask.description}
                                    </p>
                                </div>

                                {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                                    <div>
                                        <h4 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2">
                                            Teacher Attachments
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTask.attachments.map((att, idx) => (
                                                <a
                                                    key={idx}
                                                    href={att}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs font-medium hover:bg-muted text-primary transition-colors"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                    <span>Attachment {idx + 1}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Submissions section */}
                                <div>
                                    <h4 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-3">
                                        Child Submissions & Grades
                                    </h4>

                                    {(!selectedTask.childSubmissions || selectedTask.childSubmissions.length === 0) ? (
                                        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground">
                                            No submission has been turned in yet by your child for this homework task.
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {selectedTask.childSubmissions.map((sub) => (
                                                <div
                                                    key={sub.id}
                                                    className="p-4 rounded-xl border border-border/60 bg-muted/30 space-y-3"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="font-bold text-sm text-foreground">
                                                            {sub.studentName || 'Student'}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {sub.status === 'GRADED' ? (
                                                                <Badge tone="success" className="gap-1 font-bold">
                                                                    <Award className="w-3 h-3" />
                                                                    <span>
                                                                        Score: {sub.marks ?? 0} / {selectedTask.max_marks}
                                                                    </span>
                                                                </Badge>
                                                            ) : (
                                                                <Badge tone="info">Submitted</Badge>
                                                            )}
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(sub.submitted_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {sub.content && (
                                                        <div className="text-xs bg-background/60 p-3 rounded-lg border border-border/40">
                                                            <div className="font-semibold text-muted-foreground mb-1">
                                                                Student Submission Content:
                                                            </div>
                                                            <p className="whitespace-pre-wrap">{sub.content}</p>
                                                        </div>
                                                    )}

                                                    {sub.attachment_url && (
                                                        <a
                                                            href={sub.attachment_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                                                        >
                                                            <Paperclip className="w-3.5 h-3.5" />
                                                            <span>View Attached Solution File</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}

                                                    {sub.feedback && (
                                                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-900 dark:text-emerald-200">
                                                            <div className="font-bold mb-1 flex items-center gap-1.5">
                                                                <Award className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Teacher Feedback:</span>
                                                            </div>
                                                            <p>{sub.feedback}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>

                            <CardFooter className="border-t border-border/40 bg-muted/20 py-3 flex justify-end">
                                <Button variant="outline" size="sm" onClick={() => setSelectedTask(null)}>
                                    Close
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}
            </div>
        </TutorialProvider>
    );
}
