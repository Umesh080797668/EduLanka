'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BookOpen,
    Newspaper,
    Send,
    ThumbsUp,
    Lightbulb,
    Brain,
    Heart,
    MessageSquare,
    Pin,
    EyeOff,
    Plus,
    X,
    School,
    GraduationCap,
    Globe,
    Calendar,
    Flag,
    ShieldAlert,
    RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { PageHeader, EmptyState } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { Spinner } from '@/components/ui/Spinner';
import { TutorialProvider } from '@/components/TutorialProvider';

type BlogScope = 'SCHOOL' | 'CLASS' | 'PLATFORM';
type AcademicReaction = 'LIKE' | 'HELPFUL' | 'INSIGHTFUL' | 'HEART';

interface BlogReport {
    id: string;
    blog_id: string;
    reporter_id: string;
    reason: string;
    is_resolved: boolean;
    resolution_notes?: string | null;
    created_at: string;
    blog?: {
        id: string;
        title: string;
        is_published: boolean;
        author_name?: string;
    };
}

interface BlogComment {
    id: string;
    blog_id: string;
    parent_id?: string | null;
    author_id: string;
    author_name: string;
    author_role: string;
    content: string;
    is_pinned: boolean;
    is_hidden: boolean;
    created_at: string;
    replies?: BlogComment[];
}

interface BlogPost {
    id: string;
    tenant_id?: string;
    author_id: string;
    author_name?: string;
    author_role?: string;
    title: string;
    content_markdown: string;
    scope: BlogScope;
    class_id?: string | null;
    tags?: string[];
    cover_image_url?: string | null;
    is_pinned: boolean;
    is_published: boolean;
    likes_count: number;
    comments_count: number;
    created_at: string;
    updated_at?: string;
    myReaction?: AcademicReaction | null;
    comments?: BlogComment[];
}

interface TeacherClass {
    id: string;
    name: string;
    grade?: number;
}

const REACTION_CONFIG: Record<
    AcademicReaction,
    { label: string; icon: React.ElementType; color: string; bg: string }
> = {
    LIKE: {
        label: 'Useful',
        icon: ThumbsUp,
        color: 'text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    },
    HELPFUL: {
        label: 'Helpful',
        icon: Lightbulb,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    },
    INSIGHTFUL: {
        label: 'Insightful',
        icon: Brain,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    },
    HEART: {
        label: 'Inspiring',
        icon: Heart,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    },
};

export default function BlogsPage() {
    const [role, setRole] = useState<string>('');
    const [scope, setScope] = useState<BlogScope>('SCHOOL');
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Reading & Discourse modal state
    const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(null);
    const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
    const [newComment, setNewComment] = useState<string>('');
    const [replyingTo, setReplyingTo] = useState<BlogComment | null>(null);
    const [submittingComment, setSubmittingComment] = useState<boolean>(false);

    // Composer modal state
    const [composerOpen, setComposerOpen] = useState<boolean>(false);
    const [composeTitle, setComposeTitle] = useState<string>('');
    const [composeScope, setComposeScope] = useState<BlogScope>('SCHOOL');
    const [composeClassId, setComposeClassId] = useState<string>('');
    const [composeTags, setComposeTags] = useState<string>('');
    const [composeCoverUrl, setComposeCoverUrl] = useState<string>('');
    const [composeContent, setComposeContent] = useState<string>('');
    const [classes, setClasses] = useState<TeacherClass[]>([]);
    const [submittingArticle, setSubmittingArticle] = useState<boolean>(false);

    // Reporting & Moderation state
    const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
    const [reportReason, setReportReason] = useState<string>('');
    const [submittingReport, setSubmittingReport] = useState<boolean>(false);

    const [moderationOpen, setModerationOpen] = useState<boolean>(false);
    const [reports, setReports] = useState<BlogReport[]>([]);
    const [loadingReports, setLoadingReports] = useState<boolean>(false);
    const [takedownReason, setTakedownReason] = useState<string>('');
    const [takedownBlogId, setTakedownBlogId] = useState<string | null>(null);

    const isTeacherOrAdmin =
        role === 'TEACHER' || role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN';

    useEffect(() => {
        setRole(authManager.getRole());
    }, []);

    const fetchBlogs = useCallback(async (currentScope: BlogScope) => {
        setLoading(true);
        try {
            const data = await apiClient.get<BlogPost[]>(`/blogs?scope=${currentScope}`, {
                skipGlobalToast: true,
            });
            if (Array.isArray(data)) {
                setBlogs(data);
            } else if (data && Array.isArray((data as any).data)) {
                setBlogs((data as any).data);
            }
        } catch {
            toast.error('Failed to load academic blogs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBlogs(scope);
    }, [scope, fetchBlogs]);

    // Fetch classes for teacher composer
    useEffect(() => {
        if (isTeacherOrAdmin) {
            apiClient
                .get<TeacherClass[]>('/classes', { skipGlobalToast: true })
                .then((data) => {
                    if (Array.isArray(data)) setClasses(data);
                    else if (data && Array.isArray((data as any).data)) {
                        setClasses((data as any).data);
                    }
                })
                .catch(() => { });
        }
    }, [isTeacherOrAdmin]);

    const openBlogDetail = async (blog: BlogPost) => {
        setSelectedBlog(blog);
        setLoadingDetail(true);
        try {
            const detail = await apiClient.get<BlogPost>(`/blogs/${blog.id}`);
            if (detail) {
                setSelectedBlog(detail);
            }
        } catch {
            // Keep basic blog view
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleReaction = async (reactionType: AcademicReaction) => {
        if (!selectedBlog) return;

        const currentReaction = selectedBlog.myReaction;
        const isRemoving = currentReaction === reactionType;

        // Optimistic UI update
        setSelectedBlog((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                myReaction: isRemoving ? null : reactionType,
                likes_count: isRemoving
                    ? Math.max(0, prev.likes_count - 1)
                    : currentReaction
                        ? prev.likes_count
                        : prev.likes_count + 1,
            };
        });

        // Also update in list
        setBlogs((prev) =>
            prev.map((b) => {
                if (b.id !== selectedBlog.id) return b;
                return {
                    ...b,
                    likes_count: isRemoving
                        ? Math.max(0, b.likes_count - 1)
                        : currentReaction
                            ? b.likes_count
                            : b.likes_count + 1,
                };
            }),
        );

        try {
            if (isRemoving) {
                await apiClient.delete(`/blogs/${selectedBlog.id}/reactions`);
            } else {
                await apiClient.post(`/blogs/${selectedBlog.id}/reactions`, {
                    reactionType,
                });
            }
        } catch {
            toast.error('Reaction update failed');
        }
    };

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBlog || !newComment.trim()) return;

        setSubmittingComment(true);
        try {
            await apiClient.post<BlogComment>(
                `/blogs/${selectedBlog.id}/comments`,
                {
                    content: newComment.trim(),
                    ...(replyingTo ? { parentId: replyingTo.id } : {}),
                },
            );

            toast.success(replyingTo ? 'Reply posted' : 'Comment added to discourse');
            setNewComment('');
            setReplyingTo(null);

            // Re-fetch detail to get full comment hierarchy
            const updated = await apiClient.get<BlogPost>(`/blogs/${selectedBlog.id}`);
            if (updated) {
                setSelectedBlog(updated);
            }
        } catch {
            toast.error('Failed to post comment');
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleModerateComment = async (
        commentId: string,
        updates: { isPinned?: boolean; isHidden?: boolean },
    ) => {
        if (!selectedBlog) return;
        try {
            await apiClient.patch(`/blogs/comments/${commentId}/moderate`, updates);
            toast.success('Comment updated');
            // Refresh
            const updated = await apiClient.get<BlogPost>(`/blogs/${selectedBlog.id}`);
            if (updated) setSelectedBlog(updated);
        } catch {
            toast.error('Moderation action failed');
        }
    };

    const handleReportArticle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBlog || !reportReason.trim()) return;
        setSubmittingReport(true);
        try {
            await apiClient.post(`/blogs/${selectedBlog.id}/report`, {
                reason: reportReason.trim(),
            });
            toast.success('Report submitted for administrator review');
            setReportModalOpen(false);
            setReportReason('');
        } catch (err: any) {
            if (err?.response?.status === 409 || err?.message?.includes('already reported')) {
                toast.error('You have already reported this blog post');
            } else {
                toast.error('Failed to submit report');
            }
        } finally {
            setSubmittingReport(false);
        }
    };

    const handleTakedownArticle = async (blogId: string, reason?: string) => {
        try {
            await apiClient.patch(`/blogs/${blogId}/takedown`, {
                reason: reason || 'Administrative content takedown',
            });
            toast.success('Article taken down and unpublished');
            setTakedownBlogId(null);
            setTakedownReason('');
            fetchBlogs(scope);
            if (selectedBlog && selectedBlog.id === blogId) {
                setSelectedBlog({ ...selectedBlog, is_published: false });
            }
            if (moderationOpen) {
                fetchReports();
            }
        } catch {
            toast.error('Failed to take down article');
        }
    };

    const handleRestoreArticle = async (blogId: string) => {
        try {
            await apiClient.patch(`/blogs/${blogId}/restore`, {});
            toast.success('Article restored and published');
            fetchBlogs(scope);
            if (selectedBlog && selectedBlog.id === blogId) {
                setSelectedBlog({ ...selectedBlog, is_published: true });
            }
            if (moderationOpen) {
                fetchReports();
            }
        } catch {
            toast.error('Failed to restore article');
        }
    };

    const fetchReports = async () => {
        setLoadingReports(true);
        try {
            const data = await apiClient.get<BlogReport[]>('/blogs/reports');
            if (Array.isArray(data)) {
                setReports(data);
            }
        } catch {
            toast.error('Failed to load blog reports');
        } finally {
            setLoadingReports(false);
        }
    };

    const handleResolveReport = async (reportId: string) => {
        try {
            await apiClient.patch(`/blogs/reports/${reportId}`, {
                isResolved: true,
                resolutionNotes: 'Reviewed and resolved by administrator',
            });
            toast.success('Report marked as resolved');
            fetchReports();
        } catch {
            toast.error('Failed to resolve report');
        }
    };

    const handleCreateArticle = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeTitle.trim() || !composeContent.trim()) {
            toast.error('Title and content are required');
            return;
        }

        if (composeScope === 'CLASS' && !composeClassId) {
            toast.error('Please select a target class');
            return;
        }

        setSubmittingArticle(true);
        const tags = composeTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        try {
            await apiClient.post('/blogs', {
                title: composeTitle.trim(),
                contentMarkdown: composeContent.trim(),
                scope: composeScope,
                ...(composeScope === 'CLASS' ? { classId: composeClassId } : {}),
                ...(tags.length > 0 ? { tags } : {}),
                ...(composeCoverUrl.trim() ? { coverImageUrl: composeCoverUrl.trim() } : {}),
                isPublished: true,
            });

            toast.success('Academic article published successfully');
            setComposerOpen(false);
            setComposeTitle('');
            setComposeContent('');
            setComposeCoverUrl('');
            setComposeTags('');
            setComposeClassId('');
            fetchBlogs(scope);
        } catch {
            toast.error('Failed to publish article');
        } finally {
            setSubmittingArticle(false);
        }
    };

    // Render markdown preview
    const renderMarkdown = (content: string) => {
        const paragraphs = content.split('\n\n');
        return (
            <div className="space-y-4 text-slate-300 leading-relaxed text-sm md:text-base">
                {paragraphs.map((para, i) => {
                    const trimmed = para.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith('# ')) {
                        return (
                            <h2 key={i} className="text-xl md:text-2xl font-bold text-white pt-2 border-b border-slate-700 pb-2">
                                {trimmed.substring(2)}
                            </h2>
                        );
                    }
                    if (trimmed.startsWith('## ')) {
                        return (
                            <h3 key={i} className="text-lg md:text-xl font-semibold text-sky-300 pt-2">
                                {trimmed.substring(3)}
                            </h3>
                        );
                    }
                    if (trimmed.startsWith('### ')) {
                        return (
                            <h4 key={i} className="text-base md:text-lg font-medium text-slate-200">
                                {trimmed.substring(4)}
                            </h4>
                        );
                    }
                    if (trimmed.startsWith('> ')) {
                        return (
                            <blockquote key={i} className="border-l-4 border-sky-500 pl-4 py-1 italic bg-slate-800/40 rounded-r text-slate-300">
                                {trimmed.substring(2)}
                            </blockquote>
                        );
                    }
                    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                        const items = trimmed.split('\n');
                        return (
                            <ul key={i} className="list-disc list-inside space-y-1 pl-2 text-slate-300">
                                {items.map((item, idx) => (
                                    <li key={idx}>{item.replace(/^[-*]\s*/, '')}</li>
                                ))}
                            </ul>
                        );
                    }
                    return <p key={i}>{trimmed}</p>;
                })}
            </div>
        );
    };

    return (
        <TutorialProvider role={(role as any) || 'TEACHER'} screenId="blogs">
            <div className="space-y-6">
                <PageHeader
                    title="Academic Blogs & Discourse"
                    description="Pedagogical insights, subject-matter discourse, and scholarly inquiry across the EduLanka network."
                    actions={
                        <div className="flex items-center gap-2">
                            {(role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN') && (
                                <Button
                                    variant="outline"
                                    leadingIcon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
                                    onClick={() => {
                                        setModerationOpen(true);
                                        fetchReports();
                                    }}
                                    id="btn-moderation-reports"
                                >
                                    Moderation Reports
                                </Button>
                            )}
                            {isTeacherOrAdmin && (
                                <Button
                                    variant="primary"
                                    leadingIcon={<Plus className="w-4 h-4" />}
                                    onClick={() => setComposerOpen(true)}
                                    id="btn-author-article"
                                >
                                    Author Article
                                </Button>
                            )}
                        </div>
                    }
                />

                {/* Scope Tabs */}
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setScope('SCHOOL')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${scope === 'SCHOOL'
                            ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        id="tab-scope-school"
                    >
                        <School className="w-4 h-4" />
                        School-Wide
                    </button>
                    <button
                        onClick={() => setScope('CLASS')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${scope === 'CLASS'
                            ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        id="tab-scope-class"
                    >
                        <GraduationCap className="w-4 h-4" />
                        Classroom
                    </button>
                    <button
                        onClick={() => setScope('PLATFORM')}
                        className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${scope === 'PLATFORM'
                            ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        id="tab-scope-platform"
                    >
                        <Globe className="w-4 h-4" />
                        National Platform
                    </button>
                </div>

                {/* Blog Grid */}
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Spinner size="lg" />
                    </div>
                ) : blogs.length === 0 ? (
                    <EmptyState
                        icon={<Newspaper className="w-12 h-12 text-slate-500" />}
                        title={`No ${scope.toLowerCase()} articles published yet`}
                        description="Be the first to share an educational article, lesson review, or academic insight."
                        action={
                            isTeacherOrAdmin ? (
                                <Button
                                    variant="outline"
                                    leadingIcon={<Plus className="w-4 h-4" />}
                                    onClick={() => setComposerOpen(true)}
                                >
                                    Compose First Article
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {blogs.map((blog) => (
                            <motion.div
                                key={blog.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Card
                                    className={`h-full flex flex-col overflow-hidden transition-all duration-200 hover:border-sky-500/50 hover:shadow-lg hover:shadow-sky-500/5 ${blog.is_pinned ? 'border-amber-500/40 bg-amber-950/5' : ''
                                        }`}
                                >
                                    {blog.cover_image_url && (
                                        <div className="h-44 w-full overflow-hidden bg-slate-900 relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={blog.cover_image_url}
                                                alt={blog.title}
                                                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                                            />
                                        </div>
                                    )}
                                    <CardContent className="p-5 flex-1 flex flex-col justify-between">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge
                                                    tone={
                                                        blog.scope === 'PLATFORM'
                                                            ? 'info'
                                                            : blog.scope === 'CLASS'
                                                                ? 'success'
                                                                : 'neutral'
                                                    }
                                                    size="sm"
                                                >
                                                    {blog.scope === 'PLATFORM'
                                                        ? 'National'
                                                        : blog.scope === 'CLASS'
                                                            ? 'Class'
                                                            : 'School'}
                                                </Badge>
                                                {blog.is_pinned && (
                                                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                        <Pin className="w-3 h-3" /> Pinned
                                                    </span>
                                                )}
                                            </div>

                                            <h3
                                                onClick={() => openBlogDetail(blog)}
                                                className="text-lg font-bold text-white hover:text-sky-400 cursor-pointer transition-colors line-clamp-2"
                                            >
                                                {blog.title}
                                            </h3>

                                            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                                                {blog.content_markdown.replace(/[#*`_>]/g, '')}
                                            </p>

                                            {blog.tags && blog.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {blog.tags.slice(0, 3).map((tag, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                    {blog.tags.length > 3 && (
                                                        <span className="text-[11px] text-slate-500 py-0.5">
                                                            +{blog.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-sky-600/30 text-sky-300 font-bold flex items-center justify-center text-[10px]">
                                                    {blog.author_name ? blog.author_name[0].toUpperCase() : 'E'}
                                                </div>
                                                <span className="truncate max-w-[100px]">{blog.author_name || 'Educator'}</span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1 text-sky-400 font-medium">
                                                    <ThumbsUp className="w-3.5 h-3.5" />
                                                    {blog.likes_count}
                                                </span>
                                                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                    {blog.comments_count}
                                                </span>
                                                <Button
                                                    size="xs"
                                                    variant="ghost"
                                                    onClick={() => openBlogDetail(blog)}
                                                    className="text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 h-7 px-2"
                                                >
                                                    Read
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Read & Discourse Modal */}
                <Dialog
                    open={!!selectedBlog}
                    onClose={() => {
                        setSelectedBlog(null);
                        setReplyingTo(null);
                        setNewComment('');
                    }}
                    title={selectedBlog?.title || 'Academic Article'}
                    size="xl"
                >
                    {selectedBlog && (
                        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                            {/* Cover image */}
                            {selectedBlog.cover_image_url && (
                                <div className="w-full h-56 rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={selectedBlog.cover_image_url}
                                        alt={selectedBlog.title}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            {/* Metadata Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                                        {selectedBlog.author_name ? selectedBlog.author_name[0].toUpperCase() : 'E'}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white text-sm">
                                                {selectedBlog.author_name || 'Educator'}
                                            </span>
                                            <Badge variant="outline" tone="neutral" size="sm">
                                                {selectedBlog.author_role || 'TEACHER'}
                                            </Badge>
                                        </div>
                                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(selectedBlog.created_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-slate-400 hover:text-amber-400"
                                        leadingIcon={<Flag className="w-3.5 h-3.5" />}
                                        onClick={() => setReportModalOpen(true)}
                                    >
                                        Report
                                    </Button>
                                    {(role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN') && (
                                        <>
                                            {selectedBlog.is_published ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                                                    leadingIcon={<ShieldAlert className="w-3.5 h-3.5" />}
                                                    onClick={() => {
                                                        setTakedownBlogId(selectedBlog.id);
                                                        setTakedownReason('');
                                                    }}
                                                >
                                                    Takedown
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                                    leadingIcon={<RotateCcw className="w-3.5 h-3.5" />}
                                                    onClick={() => handleRestoreArticle(selectedBlog.id)}
                                                >
                                                    Restore
                                                </Button>
                                            )}
                                        </>
                                    )}
                                    <Badge
                                        tone={
                                            selectedBlog.scope === 'PLATFORM'
                                                ? 'info'
                                                : selectedBlog.scope === 'CLASS'
                                                    ? 'success'
                                                    : 'neutral'
                                        }
                                    >
                                        {selectedBlog.scope}
                                    </Badge>
                                    {selectedBlog.is_pinned && (
                                        <Badge tone="warning">
                                            <Pin className="w-3 h-3 mr-1" /> Pinned
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Article Content */}
                            <div className="py-2">
                                {renderMarkdown(selectedBlog.content_markdown)}
                            </div>

                            {/* Academic Reactions Bar */}
                            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Scholarly Reactions
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(['LIKE', 'HELPFUL', 'INSIGHTFUL', 'HEART'] as AcademicReaction[]).map((type) => {
                                        const cfg = REACTION_CONFIG[type];
                                        const Icon = cfg.icon;
                                        const isSelected = selectedBlog.myReaction === type;

                                        return (
                                            <button
                                                key={type}
                                                onClick={() => handleReaction(type)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSelected
                                                    ? cfg.bg + ' shadow-sm'
                                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                                                    }`}
                                            >
                                                <Icon className={`w-3.5 h-3.5 ${isSelected ? cfg.color : ''}`} />
                                                <span>{cfg.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Discourse & Threaded Comments */}
                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-sky-400" />
                                        Academic Discourse ({selectedBlog.comments?.length || 0})
                                    </h4>
                                </div>

                                {/* Comment Composer */}
                                <form onSubmit={handlePostComment} className="space-y-2">
                                    {replyingTo && (
                                        <div className="flex items-center justify-between bg-sky-950/40 border border-sky-800/50 px-3 py-1.5 rounded text-xs text-sky-300">
                                            <span>
                                                Replying to <strong>{replyingTo.author_name}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setReplyingTo(null)}
                                                className="text-slate-400 hover:text-white"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <Textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder={
                                                replyingTo
                                                    ? `Write an academic reply to ${replyingTo.author_name}...`
                                                    : 'Contribute scholarly analysis, questions, or perspectives...'
                                            }
                                            rows={2}
                                            className="text-xs md:text-sm"
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            type="submit"
                                            size="sm"
                                            variant="primary"
                                            loading={submittingComment}
                                            leadingIcon={<Send className="w-3.5 h-3.5" />}
                                        >
                                            Post Contribution
                                        </Button>
                                    </div>
                                </form>

                                {/* Threaded Comments List */}
                                {loadingDetail ? (
                                    <div className="flex justify-center py-6">
                                        <Spinner size="md" />
                                    </div>
                                ) : !selectedBlog.comments || selectedBlog.comments.length === 0 ? (
                                    <p className="text-center text-xs text-slate-500 py-6">
                                        No discourse entries yet. Start the academic dialogue above.
                                    </p>
                                ) : (
                                    <div className="space-y-3 pt-2">
                                        {selectedBlog.comments.map((comment) => (
                                            <div
                                                key={comment.id}
                                                className={`p-3.5 rounded-lg border text-xs md:text-sm space-y-2 ${comment.is_pinned
                                                    ? 'bg-amber-950/20 border-amber-600/30'
                                                    : 'bg-slate-900/60 border-slate-800'
                                                    } ${comment.is_hidden ? 'opacity-50' : ''}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-white">
                                                            {comment.author_name}
                                                        </span>
                                                        <Badge variant="outline" tone="neutral" size="sm">
                                                            {comment.author_role}
                                                        </Badge>
                                                        {comment.is_pinned && (
                                                            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                PINNED
                                                            </span>
                                                        )}
                                                        {comment.is_hidden && (
                                                            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                                HIDDEN
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2 text-slate-400">
                                                        <span className="text-[11px]">
                                                            {new Date(comment.created_at).toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                        {isTeacherOrAdmin && (
                                                            <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                                                                <button
                                                                    onClick={() =>
                                                                        handleModerateComment(comment.id, {
                                                                            isPinned: !comment.is_pinned,
                                                                        })
                                                                    }
                                                                    title={comment.is_pinned ? 'Unpin' : 'Pin'}
                                                                    className="p-1 hover:text-amber-400 text-slate-400"
                                                                >
                                                                    <Pin className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        handleModerateComment(comment.id, {
                                                                            isHidden: !comment.is_hidden,
                                                                        })
                                                                    }
                                                                    title={comment.is_hidden ? 'Restore' : 'Hide'}
                                                                    className="p-1 hover:text-rose-400 text-slate-400"
                                                                >
                                                                    <EyeOff className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="text-slate-300 leading-relaxed">{comment.content}</p>

                                                <div className="flex items-center justify-end pt-1">
                                                    <button
                                                        onClick={() => setReplyingTo(comment)}
                                                        className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                                                    >
                                                        Reply
                                                    </button>
                                                </div>

                                                {/* Nested replies */}
                                                {comment.replies && comment.replies.length > 0 && (
                                                    <div className="pl-4 border-l-2 border-slate-800 space-y-2 mt-2 pt-2">
                                                        {comment.replies.map((reply) => (
                                                            <div
                                                                key={reply.id}
                                                                className={`p-2.5 rounded bg-slate-950/60 border border-slate-800/80 text-xs space-y-1 ${reply.is_hidden ? 'opacity-50' : ''
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-semibold text-slate-200">
                                                                            {reply.author_name}
                                                                        </span>
                                                                        <Badge variant="outline" tone="neutral" size="sm">
                                                                            {reply.author_role}
                                                                        </Badge>
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {new Date(reply.created_at).toLocaleTimeString([], {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </span>
                                                                </div>
                                                                <p className="text-slate-300">{reply.content}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Dialog>

                {/* Author / Article Composer Modal */}
                <Dialog
                    open={composerOpen}
                    onClose={() => setComposerOpen(false)}
                    title="Author Academic Article"
                    size="lg"
                >
                    <form onSubmit={handleCreateArticle} className="space-y-4">
                        <Field label="Article Title" required>
                            <Input
                                value={composeTitle}
                                onChange={(e) => setComposeTitle(e.target.value)}
                                placeholder="e.g., Deconstructing Thermodynamics in Advanced Level Physics"
                                required
                            />
                        </Field>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Scope" required>
                                <Select
                                    value={composeScope}
                                    onChange={(e) => setComposeScope(e.target.value as BlogScope)}
                                >
                                    <option value="SCHOOL">School-Wide</option>
                                    <option value="CLASS">Classroom Specific</option>
                                    <option value="PLATFORM">National Platform</option>
                                </Select>
                            </Field>

                            {composeScope === 'CLASS' ? (
                                <Field label="Target Class" required>
                                    <Select
                                        value={composeClassId}
                                        onChange={(e) => setComposeClassId(e.target.value)}
                                        required
                                    >
                                        <option value="">Select a class...</option>
                                        {classes.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} {c.grade ? `(Grade ${c.grade})` : ''}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            ) : (
                                <Field label="Cover Image URL (Optional)">
                                    <Input
                                        value={composeCoverUrl}
                                        onChange={(e) => setComposeCoverUrl(e.target.value)}
                                        placeholder="https://images.unsplash.com/..."
                                    />
                                </Field>
                            )}
                        </div>

                        {composeScope === 'CLASS' && (
                            <Field label="Cover Image URL (Optional)">
                                <Input
                                    value={composeCoverUrl}
                                    onChange={(e) => setComposeCoverUrl(e.target.value)}
                                    placeholder="https://images.unsplash.com/..."
                                />
                            </Field>
                        )}

                        <Field label="Tags (Comma separated)">
                            <Input
                                value={composeTags}
                                onChange={(e) => setComposeTags(e.target.value)}
                                placeholder="e.g., Physics, ALevel, ExamPrep, Mechanics"
                            />
                        </Field>

                        <Field label="Article Content (Markdown Supported)" required>
                            <Textarea
                                value={composeContent}
                                onChange={(e) => setComposeContent(e.target.value)}
                                placeholder="Write your scholarly article using markdown headers (##), bullet points, and code quotes..."
                                rows={8}
                                required
                            />
                        </Field>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setComposerOpen(false)}
                                disabled={submittingArticle}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={submittingArticle}
                                leadingIcon={<BookOpen className="w-4 h-4" />}
                            >
                                Publish Article
                            </Button>
                        </div>
                    </form>
                </Dialog>

                {/* Report Article Dialog */}
                <Dialog
                    open={reportModalOpen}
                    onClose={() => setReportModalOpen(false)}
                    title="Report Article for Academic Review"
                >
                    <form onSubmit={handleReportArticle} className="space-y-4">
                        <p className="text-xs text-slate-400">
                            Please explain why this publication violates school academic integrity, safety, or community policies.
                        </p>
                        <Field label="Reason for report" required>
                            <Textarea
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                placeholder="Describe inappropriate content, copyright violation, misinformation, or harassment..."
                                rows={3}
                                required
                            />
                        </Field>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                            <Button type="button" variant="ghost" onClick={() => setReportModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" loading={submittingReport}>
                                Submit Report
                            </Button>
                        </div>
                    </form>
                </Dialog>

                {/* Administrative Takedown Dialog */}
                <Dialog
                    open={!!takedownBlogId}
                    onClose={() => setTakedownBlogId(null)}
                    title="Administrative Content Takedown"
                >
                    <div className="space-y-4">
                        <p className="text-xs text-rose-400">
                            This will immediately unpublish this article from student and educator feeds.
                        </p>
                        <Field label="Administrative Reason">
                            <Input
                                value={takedownReason}
                                onChange={(e) => setTakedownReason(e.target.value)}
                                placeholder="Reason for administrative takedown..."
                            />
                        </Field>
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                            <Button type="button" variant="ghost" onClick={() => setTakedownBlogId(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                className="bg-rose-600 hover:bg-rose-500"
                                onClick={() => takedownBlogId && handleTakedownArticle(takedownBlogId, takedownReason)}
                            >
                                Confirm Takedown
                            </Button>
                        </div>
                    </div>
                </Dialog>

                {/* Blog Moderation & Reports Dialog */}
                <Dialog
                    open={moderationOpen}
                    onClose={() => setModerationOpen(false)}
                    title="Blog Moderation & Reports"
                    className="max-w-3xl"
                >
                    <div className="space-y-4">
                        {loadingReports ? (
                            <div className="py-8 flex justify-center">
                                <Spinner />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-400">
                                No active reports found. All articles comply with academic policies.
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                {reports.map((rep) => (
                                    <div
                                        key={rep.id}
                                        className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h5 className="font-semibold text-white text-sm">
                                                {rep.blog?.title || `Article #${rep.blog_id}`}
                                            </h5>
                                            <Badge tone={rep.is_resolved ? 'neutral' : 'warning'}>
                                                {rep.is_resolved ? 'Resolved' : 'Pending Review'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-300">
                                            <strong>Reason:</strong> {rep.reason}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-800/60">
                                            <span>
                                                Reported on {new Date(rep.created_at).toLocaleDateString()}
                                            </span>
                                            <div className="flex gap-2">
                                                {!rep.is_resolved && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs py-1"
                                                        onClick={() => handleResolveReport(rep.id)}
                                                    >
                                                        Dismiss / Resolve
                                                    </Button>
                                                )}
                                                {rep.blog?.is_published !== false ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs py-1 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                                                        onClick={() => {
                                                            setTakedownBlogId(rep.blog_id);
                                                            setTakedownReason(rep.reason);
                                                        }}
                                                    >
                                                        Take Down
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs py-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                                        onClick={() => handleRestoreArticle(rep.blog_id)}
                                                    >
                                                        Restore
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Dialog>
            </div>
        </TutorialProvider>
    );
}
