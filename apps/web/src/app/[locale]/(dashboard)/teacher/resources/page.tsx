'use client';

import React, { useEffect, useState } from 'react';
import {
    BookOpen,
    FileVideo,
    Filter,
    HardDrive,
    Plus,
    Trash2,
    Video,
    AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

interface MediaAsset {
    id: string;
    title: string;
    description?: string;
    cloudinary_secure_url: string;
    mp4_url?: string;
    hls_url?: string;
    duration_seconds?: number;
    file_size_bytes: number;
    subject?: string;
    grade_level?: number;
    is_downloadable: boolean;
    status: string;
    created_at: string;
}

interface StorageUsageResponse {
    success: boolean;
    usage: {
        tenant_id: string;
        tenant_name: string;
        plan: string;
        storage_quota_gb: number;
        total_bytes_used: number;
        total_gb_used: number;
        is_quota_exceeded: boolean;
    } | null;
}

export default function TeacherResourcesPage() {
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [storageUsage, setStorageUsage] = useState<StorageUsageResponse['usage'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [selectedGrade, setSelectedGrade] = useState<string>('all');

    // New Asset Form State
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formSubject, setFormSubject] = useState('Science');
    const [formGrade, setFormGrade] = useState(10);
    const [formVideoUrl, setFormVideoUrl] = useState('');
    const [formDuration, setFormDuration] = useState(600);
    const [formSizeBytes, setFormSizeBytes] = useState(15728640); // 15MB
    const [formDownloadable, setFormDownloadable] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        try {
            const [mediaRes, storageRes] = await Promise.all([
                apiClient.get<{ data: MediaAsset[] }>('/media'),
                apiClient.get<StorageUsageResponse>('/media/storage-usage'),
            ]);
            setAssets(mediaRes.data || []);
            setStorageUsage(storageRes.usage);
        } catch (err: any) {
            toast.error('Failed to load learning resources', {
                description: err?.message || 'Network error',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formTitle || !formVideoUrl) {
            toast.error('Please complete title and video URL');
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post('/media', {
                title: formTitle,
                description: formDescription,
                cloudinaryPublicId: `video_${Date.now()}`,
                cloudinarySecureUrl: formVideoUrl,
                mp4Url: formVideoUrl,
                durationSeconds: Number(formDuration),
                fileSizeBytes: Number(formSizeBytes),
                subject: formSubject,
                gradeLevel: Number(formGrade),
                isDownloadable: formDownloadable,
            });

            toast.success('Resource added successfully');
            setIsUploadOpen(false);
            setFormTitle('');
            setFormDescription('');
            setFormVideoUrl('');
            loadData();
        } catch (err: any) {
            toast.error('Failed to upload resource', {
                description: err?.message || 'Check storage quota and parameters',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (assetId: string) => {
        if (!confirm('Are you sure you want to remove this resource and reclaim storage?')) return;
        try {
            await apiClient.delete(`/media/${assetId}`);
            toast.success('Resource removed and storage reclaimed');
            setAssets(assets.filter((a) => a.id !== assetId));
            loadData();
        } catch (err: any) {
            toast.error('Failed to delete asset', { description: err?.message });
        }
    };

    const filteredAssets = assets.filter((asset) => {
        const matchesSubject = selectedSubject === 'all' || asset.subject === selectedSubject;
        const matchesGrade = selectedGrade === 'all' || String(asset.grade_level) === selectedGrade;
        return matchesSubject && matchesGrade;
    });

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        if (mb >= 1024) {
            return `${(mb / 1024).toFixed(2)} GB`;
        }
        return `${mb.toFixed(1)} MB`;
    };

    const quotaGb = storageUsage?.storage_quota_gb ?? 0.5;
    const usedGb = storageUsage?.total_gb_used ?? 0;
    const quotaPercent = Math.min(100, Math.round((usedGb / quotaGb) * 100));

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-primary" />
                        Teacher Learning Resource Hub
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Publish video lessons, documents, and downloadable curriculum content with tenant quota accounting.
                    </p>
                </div>
                <Button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Upload New Resource
                </Button>
            </div>

            {/* Quota & Usage Banner */}
            {storageUsage && (
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <HardDrive className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold text-foreground">
                                        School Storage Quota ({storageUsage.plan} Plan)
                                    </span>
                                    {storageUsage.is_quota_exceeded && (
                                        <Badge tone="danger" className="flex items-center gap-1 text-xs">
                                            <AlertTriangle className="w-3 h-3" /> Quota Exceeded
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Used {usedGb.toFixed(2)} GB of {quotaGb} GB allocated storage
                                </p>
                            </div>
                            <div className="w-full sm:w-64 space-y-1.5">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Usage</span>
                                    <span>{quotaPercent}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 rounded-full ${
                                            quotaPercent > 90
                                                ? 'bg-rose-500'
                                                : quotaPercent > 70
                                                ? 'bg-amber-500'
                                                : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${quotaPercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span>Filter:</span>
                </div>
                <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="all">All Subjects</option>
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Sinhala">Sinhala Language</option>
                    <option value="Tamil">Tamil Language</option>
                    <option value="English">English</option>
                    <option value="History">History</option>
                    <option value="ICT">Information Technology</option>
                </select>

                <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                    <option value="all">All Grades</option>
                    {[6, 7, 8, 9, 10, 11, 12, 13].map((g) => (
                        <option key={g} value={String(g)}>
                            Grade {g}
                        </option>
                    ))}
                </select>

                <span className="text-xs text-muted-foreground ml-auto">
                    Showing {filteredAssets.length} of {assets.length} items
                </span>
            </div>

            {/* Asset Cards Grid */}
            {loading ? (
                <div className="py-12 text-center text-muted-foreground animate-pulse">
                    Loading curriculum resources...
                </div>
            ) : filteredAssets.length === 0 ? (
                <div className="py-16 text-center border rounded-xl border-dashed border-border bg-card/40 flex flex-col items-center justify-center space-y-3">
                    <FileVideo className="w-12 h-12 text-muted-foreground/60" />
                    <h3 className="text-base font-semibold text-foreground">No Resources Found</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        There are no learning resources matching your filter criteria. Click "Upload New Resource" to add content.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredAssets.map((asset) => (
                        <Card
                            key={asset.id}
                            className="border-border/60 hover:border-primary/50 transition-all flex flex-col justify-between"
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            {asset.subject && (
                                                <Badge variant="outline" className="text-xs">
                                                    {asset.subject}
                                                </Badge>
                                            )}
                                            {asset.grade_level && (
                                                <Badge tone="neutral" className="text-xs">
                                                    Grade {asset.grade_level}
                                                </Badge>
                                            )}
                                        </div>
                                        <CardTitle className="text-base font-semibold text-foreground line-clamp-1">
                                            {asset.title}
                                        </CardTitle>
                                    </div>
                                    <Badge
                                        tone={asset.is_downloadable ? 'success' : 'neutral'}
                                        variant={asset.is_downloadable ? 'soft' : 'outline'}
                                        className="text-[10px] shrink-0"
                                    >
                                        {asset.is_downloadable ? 'Offline Ready' : 'Stream Only'}
                                    </Badge>
                                </div>
                                {asset.description && (
                                    <CardDescription className="text-xs line-clamp-2 mt-1">
                                        {asset.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent className="pt-0 space-y-4">
                                <div className="text-xs text-muted-foreground flex items-center justify-between border-t border-border/50 pt-3">
                                    <span>Size: {formatBytes(asset.file_size_bytes)}</span>
                                    {asset.duration_seconds && (
                                        <span>
                                            Duration: {Math.floor(asset.duration_seconds / 60)}m{' '}
                                            {asset.duration_seconds % 60}s
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <a
                                        href={asset.cloudinary_secure_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                                    >
                                        <Video className="w-3.5 h-3.5" /> Preview Stream
                                    </a>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(asset.id)}
                                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 h-8 px-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Upload Resource Modal */}
            <Dialog open={isUploadOpen} onClose={() => setIsUploadOpen(false)}>
                <div className="p-6 space-y-4">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Add Learning Resource</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Publish video content with metadata for students and mobile offline caching.
                        </p>
                    </div>

                    <form onSubmit={handleCreateAsset} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground">Resource Title *</label>
                            <input
                                type="text"
                                required
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="e.g. Unit 4: Photosynthesis & Chloroplast Structure"
                                className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground">Description</label>
                            <textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                rows={2}
                                placeholder="Brief lesson summary and key learning outcomes..."
                                className="w-full p-2.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-foreground">Subject</label>
                                <select
                                    value={formSubject}
                                    onChange={(e) => setFormSubject(e.target.value)}
                                    className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="Science">Science</option>
                                    <option value="Mathematics">Mathematics</option>
                                    <option value="Sinhala">Sinhala Language</option>
                                    <option value="Tamil">Tamil Language</option>
                                    <option value="English">English</option>
                                    <option value="History">History</option>
                                    <option value="ICT">ICT</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-foreground">Grade Level</label>
                                <select
                                    value={formGrade}
                                    onChange={(e) => setFormGrade(Number(e.target.value))}
                                    className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    {[6, 7, 8, 9, 10, 11, 12, 13].map((g) => (
                                        <option key={g} value={g}>
                                            Grade {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-foreground">Video Stream URL *</label>
                            <input
                                type="url"
                                required
                                value={formVideoUrl}
                                onChange={(e) => setFormVideoUrl(e.target.value)}
                                placeholder="https://res.cloudinary.com/edulanka/video/upload/sample.mp4"
                                className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-foreground">Duration (Seconds)</label>
                                <input
                                    type="number"
                                    value={formDuration}
                                    onChange={(e) => setFormDuration(Number(e.target.value))}
                                    className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-foreground">File Size (Bytes)</label>
                                <input
                                    type="number"
                                    value={formSizeBytes}
                                    onChange={(e) => setFormSizeBytes(Number(e.target.value))}
                                    className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="downloadableCheck"
                                checked={formDownloadable}
                                onChange={(e) => setFormDownloadable(e.target.checked)}
                                className="rounded border-border text-primary focus:ring-primary"
                            />
                            <label htmlFor="downloadableCheck" className="text-xs font-medium text-foreground cursor-pointer">
                                Enable encrypted offline download for students (Growth / Institutional plans)
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-border">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsUploadOpen(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? 'Uploading...' : 'Publish Resource'}
                            </Button>
                        </div>
                    </form>
                </div>
            </Dialog>
        </div>
    );
}
