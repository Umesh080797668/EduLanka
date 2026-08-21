'use client';

import * as React from 'react';
import { BellOff, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { Alert } from '@/components/ui/Alert';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';

/** Priority drives both the badge tone and the card's accent border. */
const PRIORITY: Record<string, { tone: BadgeTone; ring: string }> = {
    URGENT: { tone: 'danger', ring: 'ring-2 ring-destructive/35' },
    HIGH: { tone: 'warning', ring: 'ring-2 ring-warning/35' },
    NORMAL: { tone: 'info', ring: '' },
    LOW: { tone: 'neutral', ring: '' },
};

export default function NoticeFeed() {
    const t = useTranslations('Notices');
    const [notices, setNotices] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [acking, setAcking] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        apiClient
            .get<any[]>('/notices', { skipGlobalToast: true })
            .then((data) => {
                if (isMounted) setNotices(Array.isArray(data) ? data : []);
            })
            .catch((err: any) => {
                if (isMounted) setError(err.message || t('loadFailed'));
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const markAsRead = async (id: string) => {
        setAcking(id);
        try {
            await apiClient.post(`/notices/${id}/read`, {}, { skipGlobalToast: true });
            setNotices((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
            );
        } catch (err: any) {
            toast.error(t('ackFailed'), { description: err.message });
        } finally {
            setAcking(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="rounded-card border border-border bg-card p-5 shadow-card"
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <Skeleton className="h-4 w-2/5" />
                            <Skeleton className="h-5 w-16 rounded-pill" />
                        </div>
                        <Skeleton className="mb-2 h-3 w-full" />
                        <Skeleton className="h-3 w-4/5" />
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <Alert tone="danger" title={t('loadFailed')}>
                {error}
            </Alert>
        );
    }

    if (notices.length === 0) {
        return <EmptyState icon={<BellOff />} title={t('noNotices')} />;
    }

    return (
        <div className="space-y-4">
            {notices.map((notice, idx) => {
                const priority = PRIORITY[notice.priority] ?? PRIORITY['NORMAL']!;
                return (
                    <motion.article
                        key={notice.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                        className={cn(
                            'rounded-card border border-border bg-card p-5 shadow-card',
                            'transition-[box-shadow] duration-200 hover:shadow-card-hover',
                            priority.ring,
                        )}
                    >
                        <header className="mb-3 flex items-start justify-between gap-3">
                            <h3 className="text-base font-bold leading-snug tracking-tight text-foreground">
                                {notice.title}
                            </h3>
                            <Badge tone={priority.tone} size="sm" className="shrink-0">
                                {t(`priority_${notice.priority}`)}
                            </Badge>
                        </header>

                        {/* Notice bodies are authored as HTML by school staff. */}
                        <div
                            className="text-[15px] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
                            dangerouslySetInnerHTML={{ __html: notice.content_html }}
                        />

                        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3.5">
                            <div className="min-w-0">
                                <p className="numeric text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {new Date(notice.created_at).toLocaleDateString()}
                                </p>
                                {(notice.author?.first_name || notice.author?.last_name) && (
                                    <p className="mt-0.5 truncate text-xs font-semibold text-foreground">
                                        {t('postedBy')} {notice.author?.first_name}{' '}
                                        {notice.author?.last_name}
                                    </p>
                                )}
                            </div>

                            {notice.is_read ? (
                                <Badge tone="success" size="sm">
                                    <Check className="size-3.5" />
                                    {t('acknowledged')}
                                </Badge>
                            ) : (
                                <Button
                                    size="sm"
                                    loading={acking === notice.id}
                                    onClick={() => markAsRead(notice.id)}
                                >
                                    {t('acknowledge')}
                                </Button>
                            )}
                        </footer>
                    </motion.article>
                );
            })}
        </div>
    );
}
