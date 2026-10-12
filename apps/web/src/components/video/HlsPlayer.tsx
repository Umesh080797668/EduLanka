'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, Loader2 } from 'lucide-react';

interface HlsPlayerProps {
    hlsUrl?: string | null;
    mp4Url?: string | null;
    title?: string;
    poster?: string;
    autoPlay?: boolean;
}

export function HlsPlayer({ hlsUrl, mp4Url, poster, autoPlay = true }: HlsPlayerProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
    const [levels, setLevels] = useState<{ id: number; height: number; bitrate: number }[]>([]);
    const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 is auto
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const streamSource = hlsUrl || mp4Url;

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamSource) return;

        setIsLoading(true);
        setError(null);

        let hls: Hls | null = null;

        // If HLS URL is provided and Hls.js is supported in browser
        if (hlsUrl && Hls.isSupported()) {
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90,
            });

            hls.loadSource(hlsUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                setIsLoading(false);
                const qualityLevels = data.levels.map((lvl, index) => ({
                    id: index,
                    height: lvl.height,
                    bitrate: lvl.bitrate,
                }));
                setLevels(qualityLevels);
                if (autoPlay) {
                    video.play().catch(() => {
                        // Autoplay prevented by browser policy
                    });
                }
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
                setCurrentLevel(data.level);
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls?.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls?.recoverMediaError();
                            break;
                        default:
                            setError('Unable to load video stream');
                            hls?.destroy();
                            break;
                    }
                }
            });

            setHlsInstance(hls);
        } else if (video.canPlayType('application/vnd.apple.mpegurl') && hlsUrl) {
            // Native HLS support (Safari iOS / macOS)
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                setIsLoading(false);
                if (autoPlay) video.play().catch(() => {});
            });
        } else if (mp4Url) {
            // Direct MP4 fallback
            video.src = mp4Url;
            video.addEventListener('loadedmetadata', () => {
                setIsLoading(false);
                if (autoPlay) video.play().catch(() => {});
            });
        } else {
            setError('No compatible video stream format found');
            setIsLoading(false);
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, [hlsUrl, mp4Url, autoPlay, streamSource]);

    const handleLevelChange = (levelIndex: number) => {
        if (!hlsInstance) return;
        hlsInstance.currentLevel = levelIndex;
        setCurrentLevel(levelIndex);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center group"
        >
            {error ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-white/80 space-y-2">
                    <AlertCircle className="w-10 h-10 text-rose-500" />
                    <p className="text-sm font-medium">{error}</p>
                    {mp4Url && (
                        <a
                            href={mp4Url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline mt-2"
                        >
                            Open direct MP4 link
                        </a>
                    )}
                </div>
            ) : (
                <>
                    <video
                        ref={videoRef}
                        poster={poster}
                        playsInline
                        controls
                        onWaiting={() => setIsLoading(true)}
                        onPlaying={() => setIsLoading(false)}
                        className="w-full h-full object-contain"
                    />

                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        </div>
                    )}

                    {/* Quality Switcher Badge */}
                    {levels.length > 0 && (
                        <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md rounded-lg p-1.5 border border-white/10 flex items-center gap-1.5">
                            <span className="text-[10px] text-white/60 uppercase font-semibold tracking-wider px-1">
                                Quality:
                            </span>
                            <select
                                value={currentLevel}
                                onChange={(e) => handleLevelChange(Number(e.target.value))}
                                className="bg-black text-white text-xs rounded px-2 py-0.5 border border-white/20 focus:outline-none"
                            >
                                <option value={-1}>Auto (Adaptive)</option>
                                {levels.map((lvl) => (
                                    <option key={lvl.id} value={lvl.id}>
                                        {lvl.height}p ({Math.round(lvl.bitrate / 1000)}k)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
