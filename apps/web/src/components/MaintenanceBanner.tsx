'use client';

import * as React from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

export interface MaintenanceNotice {
    id: string;
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    scheduled_start: string;
    scheduled_end?: string | null;
    is_active: boolean;
}

export default function MaintenanceBanner() {
    const t = useTranslations('MaintenanceBanner');
    const [notices, setNotices] = React.useState<MaintenanceNotice[]>([]);
    const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(() => new Set());

    const fetchNotices = React.useCallback(async () => {
        try {
            const data = await apiClient.get<MaintenanceNotice[]>('/notices/maintenance/active', {
                skipGlobalToast: true,
            });
            if (Array.isArray(data)) {
                setNotices(data.filter((n) => n.is_active));
            }
        } catch {
            // Ignore failure silently
        }
    }, []);

    React.useEffect(() => {
        let isMounted = true;

        const loadInitial = async () => {
            try {
                const data = await apiClient.get<MaintenanceNotice[]>('/notices/maintenance/active', {
                    skipGlobalToast: true,
                });
                if (isMounted && Array.isArray(data)) {
                    setNotices(data.filter((n) => n.is_active));
                }
            } catch {
                // Ignore failure silently
            }
        };

        void loadInitial();

        // ---------------- Realtime listener ----------------
        const notificationMethod = process.env.NEXT_PUBLIC_NOTIFICATION_METHOD || 'socket.io';
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        let cleanup = () => { };

        if (notificationMethod === 'supabase' || apiUrl.includes('vercel.app')) {
            try {
                const supabase = createSupabaseBrowserClient();
                const channel = supabase
                    .channel('system_notifications')
                    .on('broadcast', { event: 'system_notification' }, () => {
                        void fetchNotices();
                    })
                    .subscribe();

                cleanup = () => {
                    supabase.removeChannel(channel);
                };
            } catch {
                // fallback
            }
        } else {
            try {
                const socket = io(apiUrl || 'http://localhost:8081', {
                    transports: ['polling', 'websocket'],
                    autoConnect: true,
                });
                socket.on('system_notification', () => {
                    void fetchNotices();
                });
                cleanup = () => {
                    socket.disconnect();
                };
            } catch {
                // fallback
            }
        }

        return () => {
            isMounted = false;
            cleanup();
        };
    }, [fetchNotices]);

    const activeNotice = notices.find((n) => !dismissedIds.has(n.id));
    if (!activeNotice) return null;

    const isCritical = activeNotice.severity === 'CRITICAL';
    const isWarning = activeNotice.severity === 'WARNING';

    const Icon = isCritical ? AlertTriangle : isWarning ? AlertCircle : Info;

    const formatSchedule = () => {
        try {
            const start = new Date(activeNotice.scheduled_start).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
            if (!activeNotice.scheduled_end) return `${t('scheduled')}: ${start}`;
            const end = new Date(activeNotice.scheduled_end).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
            return `${t('scheduled')}: ${start} – ${end}`;
        } catch {
            return null;
        }
    };

    const scheduleText = formatSchedule();

    return (
        <div
            role="region"
            aria-label={t('bannerLabel')}
            className={cn(
                'relative z-50 flex items-center justify-between gap-4 border-b px-4 py-2.5 text-sm transition-colors duration-200 sm:px-6',
                isCritical &&
                'border-destructive/40 bg-destructive/15 text-destructive font-medium shadow-xs',
                isWarning &&
                'border-warning/40 bg-warning/15 text-warning font-medium shadow-xs',
                !isCritical &&
                !isWarning &&
                'border-primary/30 bg-primary/10 text-foreground font-medium shadow-xs',
            )}
        >
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <Icon
                    className={cn(
                        'size-5 shrink-0',
                        isCritical && 'text-destructive',
                        isWarning && 'text-warning',
                        !isCritical && !isWarning && 'text-primary',
                    )}
                    aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-bold tracking-tight truncate">
                        {activeNotice.title}
                    </span>
                    <span className="truncate text-xs opacity-90">
                        {activeNotice.message}
                    </span>
                    {scheduleText && (
                        <span className="shrink-0 text-xs font-semibold numeric opacity-80 sm:ml-auto">
                            {scheduleText}
                        </span>
                    )}
                </div>
            </div>

            <button
                type="button"
                onClick={() => setDismissedIds((prev) => new Set([...prev, activeNotice.id]))}
                aria-label={t('dismiss')}
                className="shrink-0 rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
