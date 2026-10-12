'use client';

import React, { useEffect, useState } from 'react';
import {
    BookOpen,
    Download,
    FileVideo,
    Filter,
    Play,
    Search,
    X,
    Lock,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { HlsPlayer } from '@/components/video/HlsPlayer';

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

export default function StudentResourcesPage() {
    const [assets, setAssets] = useState<MediaAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [activeVideo, setActiveVideo] = useState<MediaAsset | null>(null);

    const loadAssets = async () => {
        try {
            const res = await apiClient.get<{ data: MediaAsset[] }>('/media');
            setAssets(res.data || []);
        } catch (err: any) {
            toast.error('Failed to load learning resources', {
                description: err?.message || 'Network error',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssets();
    }, []);

    const handleDownloadManifest = async (asset: MediaAsset) => {
        try {
            const manifest = await apiClient.get<{
                assetId: string;
                title: string;
                mp4Url: string;
                expiresAt: string;
                retentionDays: number;
                cipherAlgorithm: string;
            }>(`/media/${asset.id}/download-manifest`);

            toast.success('Offline License Acquired', {
                description: `Encrypted manifest generated for "${asset.title}". Valid for ${manifest.retentionDays} days offline.`,
            });
        } catch (err: any) {
            toast.error('Offline download unavailable', {
                description: err?.message || 'Requires school Growth/Institutional plan subscription.',
            });
        }
    };

    const filtered = assets.filter((asset) => {
        const matchesSearch =
            asset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (asset.description && asset.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesSubject = selectedSubject === 'all' || asset.subject === selectedSubject;
        return matchesSearch && matchesSubject;
    });

    const formatBytes = (bytes: number) => {
        if (!bytes || bytes === 0) return '0 MB';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    return (
        <TutorialProvider role="STUDENT" screenId="resources">
            <div className="space-y-6 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-primary" />
                    Student Learning Resource Hub
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Watch curriculum video lessons and save encrypted media manifests for offline study on mobile.
                </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search topics or lessons..."
                        className="w-full pl-9 pr-3 h-9 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-auto"
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

                <span className="text-xs text-muted-foreground sm:ml-auto">
                    {filtered.length} resources available
                </span>
            </div>

            {/* Resource Grid */}
            {loading ? (
                <div className="py-12 text-center text-muted-foreground animate-pulse">
                    Loading lesson library...
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center border rounded-xl border-dashed border-border bg-card/40 flex flex-col items-center justify-center space-y-3">
                    <FileVideo className="w-12 h-12 text-muted-foreground/60" />
                    <h3 className="text-base font-semibold text-foreground">No Resources Found</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        There are no published learning materials matching your criteria.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.map((asset) => (
                        <Card
                            key={asset.id}
                            className="border-border/60 hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden group"
                        >
                            <div className="relative aspect-video bg-muted/60 flex items-center justify-center border-b border-border/50 group-hover:bg-muted/80 transition-colors">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setActiveVideo(asset)}
                                    className="w-12 h-12 rounded-full shadow-lg bg-background/90 hover:scale-105 transition-transform"
                                >
                                    <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
                                </Button>
                                {asset.duration_seconds && (
                                    <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                        {Math.floor(asset.duration_seconds / 60)}:
                                        {String(asset.duration_seconds % 60).padStart(2, '0')}
                                    </span>
                                )}
                            </div>

                            <CardHeader className="pb-2">
                                <div className="flex items-center gap-1.5 mb-1">
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
                                {asset.description && (
                                    <CardDescription className="text-xs line-clamp-2 mt-1">
                                        {asset.description}
                                    </CardDescription>
                                )}
                            </CardHeader>

                            <CardContent className="pt-0 space-y-3">
                                <div className="text-xs text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2.5">
                                    <span>File Size: {formatBytes(asset.file_size_bytes)}</span>
                                    <span>Status: Ready</span>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActiveVideo(asset)}
                                        className="text-xs flex items-center gap-1 flex-1"
                                    >
                                        <Play className="w-3.5 h-3.5" /> Watch Now
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleDownloadManifest(asset)}
                                        className="text-xs flex items-center gap-1"
                                        title={
                                            asset.is_downloadable
                                                ? 'Acquire offline license for mobile app'
                                                : 'Requires Growth plan'
                                        }
                                    >
                                        {asset.is_downloadable ? (
                                            <>
                                                <Download className="w-3.5 h-3.5" /> Save Offline
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Offline
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Video Player Modal */}
            <Dialog open={!!activeVideo} onClose={() => setActiveVideo(null)}>
                {activeVideo && (
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    {activeVideo.title}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {activeVideo.subject} · Grade {activeVideo.grade_level}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setActiveVideo(null)}
                                className="h-8 w-8 p-0"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <HlsPlayer
                            hlsUrl={activeVideo.hls_url}
                            mp4Url={activeVideo.mp4_url || activeVideo.cloudinary_secure_url}
                            title={activeVideo.title}
                            autoPlay={true}
                        />

                        {activeVideo.description && (
                            <p className="text-xs text-muted-foreground pt-1">
                                {activeVideo.description}
                            </p>
                        )}
                    </div>
                )}
            </Dialog>
        </div>
        </TutorialProvider>
    );
}
