'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    BookOpen,
    FileVideo,
    Filter,
    HardDrive,
    Plus,
    Trash2,
    Video,
    UploadCloud,
    Link as LinkIcon,
    Loader2,
    CheckCircle2,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useTranslations } from 'next-intl';

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
    status: 'processing' | 'ready' | 'failed' | 'deleted' | string;
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

interface UploadSignatureResponse {
    timestamp: number;
    folder: string;
    signature: string;
    apiKey: string;
    cloudName: string;
    allowedFormats: string;
    uploadPreset: string | null;
    maxFileSize: number;
    type?: string;
    eager?: string;
}

function generateEmbedPublicId(): string {
    return `embed_${Date.now()}`;
}

export default function TeacherResourcesPage() {
    const t = useTranslations('MediaResources');
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [storageUsage, setStorageUsage] = useState<StorageUsageResponse['usage'] | null>(null);
    const [loading, setLoading] = useState(true);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [selectedGrade, setSelectedGrade] = useState<string>('all');

    // Upload Mode: 'file' (Signed Direct Upload) or 'embed' (External YouTube/Vimeo/Drive URL)
    const [uploadMode, setUploadMode] = useState<'file' | 'embed'>('file');

    // Common Form State
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formSubject, setFormSubject] = useState('Science');
    const [formGrade, setFormGrade] = useState(10);
    const [formDownloadable, setFormDownloadable] = useState(true);

    // File Upload State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Embed Form State
    const [embedUrl, setEmbedUrl] = useState('');

    const refreshData = useCallback(async () => {
        try {
            const [mediaRes, storageRes] = await Promise.all([
                apiClient.get<{ data: MediaAsset[] }>('/media'),
                apiClient.get<StorageUsageResponse>('/media/storage-usage'),
            ]);
            setAssets(mediaRes.data || []);
            setStorageUsage(storageRes.usage);
        } catch (err: any) {
            toast.error(t('loadFailed'), {
                description: err?.message || 'Network error',
            });
        } finally {
            setLoading(false);
        }
    }, [t]);
    const loadData = refreshData;

    useEffect(() => {
        let isMounted = true;
        Promise.all([
            apiClient.get<{ data: MediaAsset[] }>('/media'),
            apiClient.get<StorageUsageResponse>('/media/storage-usage'),
        ])
            .then(([mediaRes, storageRes]) => {
                if (!isMounted) return;
                setAssets(mediaRes.data || []);
                setStorageUsage(storageRes.usage);
            })
            .catch((err: any) => {
                if (!isMounted) return;
                toast.error(t('loadFailed'), {
                    description: err?.message || 'Network error',
                });
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Polling interval if any assets are currently in transcoding/processing state
    useEffect(() => {
        const hasProcessing = assets.some((a) => a.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            loadData();
        }, 8000);

        return () => clearInterval(interval);
    }, [assets, loadData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            if (!formTitle) {
                // Auto-suggest title from filename without extension
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                setFormTitle(nameWithoutExt);
            }
        }
    };

    const handleSignedUploadAndSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (uploadMode === 'file') {
            if (!selectedFile) {
                toast.error(t('selectFile'));
                return;
            }
            if (!formTitle) {
                toast.error(t('titleRequired'));
                return;
            }

            setIsUploading(true);
            setUploadProgress(0);

            try {
                // 1. Fetch Cloudinary signed upload token from backend (quota enforced)
                const sig = await apiClient.get<UploadSignatureResponse>('/upload/signature?folderType=videos');

                // 2. Perform direct browser-to-Cloudinary signed upload with progress tracking
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('api_key', sig.apiKey);
                formData.append('timestamp', String(sig.timestamp));
                formData.append('signature', sig.signature);
                formData.append('folder', sig.folder);
                if (sig.allowedFormats) {
                    formData.append('allowed_formats', sig.allowedFormats);
                }
                if (sig.type) {
                    formData.append('type', sig.type);
                }
                if (sig.eager) {
                    formData.append('eager', sig.eager);
                }
                if (sig.uploadPreset) {
                    formData.append('upload_preset', sig.uploadPreset);
                }

                const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/video/upload`;

                const cloudinaryResult = await new Promise<any>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', uploadUrl);

                    xhr.upload.onprogress = (evt) => {
                        if (evt.lengthComputable) {
                            const percentComplete = Math.round((evt.loaded / evt.total) * 100);
                            setUploadProgress(percentComplete);
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                resolve(JSON.parse(xhr.responseText));
                            } catch {
                                reject(new Error('Invalid JSON response from Cloudinary'));
                            }
                        } else {
                            try {
                                const errRes = JSON.parse(xhr.responseText);
                                reject(new Error(errRes.error?.message || 'Cloudinary upload failed'));
                            } catch {
                                reject(new Error(`Upload failed with status ${xhr.status}`));
                            }
                        }
                    };

                    xhr.onerror = () => reject(new Error('Network error during video upload'));
                    xhr.send(formData);
                });

                // 3. Create media asset record in API.
                // Starts in status: 'processing' until Cloudinary transcoding webhook confirms HLS renditions.
                await apiClient.post('/media', {
                    title: formTitle,
                    description: formDescription,
                    cloudinaryPublicId: cloudinaryResult.public_id,
                    cloudinarySecureUrl: cloudinaryResult.secure_url,
                    mp4Url: cloudinaryResult.secure_url,
                    durationSeconds: Math.round(cloudinaryResult.duration || 0),
                    fileSizeBytes: cloudinaryResult.bytes || selectedFile.size,
                    subject: formSubject,
                    gradeLevel: Number(formGrade),
                    isDownloadable: formDownloadable,
                });

                toast.success(t('uploadSuccess'), {
                    description: 'Asset is now transcoding into adaptive HLS streams.',
                });

                resetForm();
                loadData();
            } catch (err: any) {
                toast.error(t('uploadFailed'), {
                    description: err?.message || 'Failed to complete video upload',
                });
            } finally {
                setIsUploading(false);
            }
        } else {
            // External Embed Link (YouTube, Vimeo, Google Drive)
            if (!embedUrl || !formTitle) {
                toast.error(t('embedRequired'));
                return;
            }

            setIsUploading(true);
            try {
                await apiClient.post('/media', {
                    title: formTitle,
                    description: formDescription,
                    cloudinaryPublicId: generateEmbedPublicId(),
                    cloudinarySecureUrl: embedUrl,
                    subject: formSubject,
                    gradeLevel: Number(formGrade),
                    isDownloadable: false,
                });

                toast.success(t('embedSuccess'));
                resetForm();
                loadData();
            } catch (err: any) {
                toast.error(t('uploadFailed'), {
                    description: err?.message,
                });
            } finally {
                setIsUploading(false);
            }
        }
    };

    const resetForm = () => {
        setIsUploadOpen(false);
        setFormTitle('');
        setFormDescription('');
        setEmbedUrl('');
        setSelectedFile(null);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (assetId: string) => {
        if (!confirm('Are you sure you want to remove this resource and reclaim storage quota?')) return;
        try {
            await apiClient.delete(`/media/${assetId}`);
            toast.success(t('deleteSuccess'));
            setAssets(assets.filter((a) => a.id !== assetId));
            loadData();
        } catch (err: any) {
            toast.error(t('deleteFailed'), { description: err?.message });
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
        <TutorialProvider role="TEACHER" screenId="resources">
            <div className="space-y-6 p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-primary" />
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            className="flex items-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </Button>
                        <Button
                            onClick={() => setIsUploadOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {t('uploadVideo')}
                        </Button>
                    </div>
                </div>

                {/* Storage Quota Card */}
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <HardDrive className="w-5 h-5 text-primary" />
                                <CardTitle className="text-base font-semibold">School Media Storage Ledger</CardTitle>
                            </div>
                            <Badge
                                tone={storageUsage?.is_quota_exceeded ? 'danger' : 'info'}
                                variant="soft"
                            >
                                Plan: {storageUsage?.plan || 'Community'}
                            </Badge>
                        </div>
                        <CardDescription className="text-xs">
                            {storageUsage?.tenant_name || 'Institution'} quota accounting with signed upload verification
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Used: {usedGb.toFixed(2)} GB ({quotaPercent}%)</span>
                            <span>Quota Limit: {quotaGb} GB</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${storageUsage?.is_quota_exceeded
                                    ? 'bg-rose-500'
                                    : quotaPercent > 80
                                        ? 'bg-amber-500'
                                        : 'bg-primary'
                                    }`}
                                style={{ width: `${quotaPercent}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="all">All Subjects</option>
                            <option value="Science">Science</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Sinhala">Sinhala</option>
                            <option value="Tamil">Tamil</option>
                            <option value="English">English</option>
                            <option value="History">History</option>
                            <option value="ICT">ICT</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
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
                    </div>

                    <span className="text-xs text-muted-foreground sm:ml-auto">
                        Showing {filteredAssets.length} of {assets.length} resources
                    </span>
                </div>

                {/* Media Asset List */}
                {loading ? (
                    <div className="py-12 text-center text-muted-foreground animate-pulse">
                        Loading media assets...
                    </div>
                ) : filteredAssets.length === 0 ? (
                    <div className="py-16 text-center border rounded-xl border-dashed border-border bg-card/40 flex flex-col items-center justify-center space-y-3">
                        <FileVideo className="w-12 h-12 text-muted-foreground/60" />
                        <h3 className="text-base font-semibold text-foreground">No Media Resources</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Upload your first video lesson using signed Cloudinary direct streaming or add an embedded URL.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredAssets.map((asset) => (
                            <Card key={asset.id} className="border-border/60 flex flex-col justify-between">
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {asset.subject || 'General'}
                                                </Badge>
                                                {asset.grade_level && (
                                                    <Badge variant="soft" className="text-[10px]">
                                                        Grade {asset.grade_level}
                                                    </Badge>
                                                )}
                                                {asset.status === 'processing' && (
                                                    <Badge tone="warning" variant="soft" className="text-[10px] flex items-center gap-1">
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Transcoding
                                                    </Badge>
                                                )}
                                                {asset.status === 'ready' && (
                                                    <Badge tone="success" variant="soft" className="text-[10px] flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Ready
                                                    </Badge>
                                                )}
                                                {asset.status === 'failed' && (
                                                    <Badge tone="danger" variant="soft" className="text-[10px]">
                                                        Failed
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-base font-bold line-clamp-1 mt-1">
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
                <Dialog open={isUploadOpen} onClose={() => !isUploading && resetForm()}>
                    <div className="p-6 space-y-4 max-w-lg">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">Add Learning Resource</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Publish video content with signed direct uploads, automated HLS transcoding, and encrypted offline caching.
                            </p>
                        </div>

                        {/* Mode Selector Tabs */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                            <button
                                type="button"
                                onClick={() => setUploadMode('file')}
                                className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${uploadMode === 'file'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <UploadCloud className="w-3.5 h-3.5" /> Direct Video File (HLS)
                            </button>
                            <button
                                type="button"
                                onClick={() => setUploadMode('embed')}
                                className={`py-1.5 px-3 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${uploadMode === 'embed'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <LinkIcon className="w-3.5 h-3.5" /> External Embed Link
                            </button>
                        </div>

                        <form onSubmit={handleSignedUploadAndSubmit} className="space-y-4">
                            {uploadMode === 'file' ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-foreground">Select Video File *</label>
                                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="video/mp4,video/mov,video/webm,video/avi"
                                            onChange={handleFileChange}
                                            disabled={isUploading}
                                            className="hidden"
                                            id="videoFileInput"
                                        />
                                        <label htmlFor="videoFileInput" className="cursor-pointer flex flex-col items-center space-y-2">
                                            <UploadCloud className="w-8 h-8 text-muted-foreground/80" />
                                            <span className="text-xs text-foreground font-medium">
                                                {selectedFile ? selectedFile.name : 'Click to select MP4, MOV, or WEBM video'}
                                            </span>
                                            {selectedFile && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    Size: {formatBytes(selectedFile.size)}
                                                </span>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-foreground">External Video / Embed URL *</label>
                                    <input
                                        type="url"
                                        required
                                        value={embedUrl}
                                        onChange={(e) => setEmbedUrl(e.target.value)}
                                        placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                                        className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                        Supported for Starter & Community subscriptions without storage quota deductions.
                                    </p>
                                </div>
                            )}

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

                            {uploadMode === 'file' && (
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        id="downloadableCheck"
                                        checked={formDownloadable}
                                        onChange={(e) => setFormDownloadable(e.target.checked)}
                                        className="rounded border-border text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="downloadableCheck" className="text-xs font-medium text-foreground cursor-pointer">
                                        Enable encrypted offline download for students (Growth / Institutional)
                                    </label>
                                </div>
                            )}

                            {/* Upload Progress Bar */}
                            {isUploading && uploadMode === 'file' && (
                                <div className="space-y-1.5 pt-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span>Uploading to Cloudinary...</span>
                                        <span>{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-150"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-3 border-t border-border">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={resetForm}
                                    disabled={isUploading}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isUploading}>
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                            {uploadProgress < 100 ? `Uploading ${uploadProgress}%` : 'Registering...'}
                                        </>
                                    ) : (
                                        'Publish Resource'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Dialog>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
