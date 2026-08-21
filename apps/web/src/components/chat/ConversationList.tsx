'use client';

import * as React from 'react';
import { MessagesSquare, Users, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Conversation } from './types';

/** Previews and unread counts go stale silently, so re-pull on a slow cadence. */
const REFRESH_MS = 45_000;

/** Time for today's activity, day + month for anything older. */
function timeLabel(iso: string): string {
    const at = new Date(iso);
    return at.toDateString() === new Date().toDateString()
        ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : at.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

interface ConversationListProps {
    selectedId: string | null;
    onSelect: (conversation: Conversation) => void;
}

export default function ConversationList({ selectedId, onSelect }: ConversationListProps) {
    const t = useTranslations('Chat');
    const [conversations, setConversations] = React.useState<Conversation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    // Opening a thread clears its badge at once; the next refresh confirms it.
    const [opened, setOpened] = React.useState<string[]>([]);
    const [me] = React.useState(() => authManager.getUserId());

    React.useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const data = await apiClient.get<Conversation[]>('/chat/conversations', {
                    skipGlobalToast: true,
                });
                if (!isMounted) return;
                setConversations(Array.isArray(data) ? data : []);
                setError(null);
            } catch (err: any) {
                if (isMounted) setError(err?.message || null);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, []);

    const handleSelect = (conversation: Conversation) => {
        setOpened((prev) => (prev.includes(conversation.id) ? prev : [...prev, conversation.id]));
        onSelect(conversation);
    };

    if (loading) {
        return (
            <div className="flex-1 space-y-1 p-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2">
                        <Skeleton className="size-9 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-3/4" />
                            <Skeleton className="h-2.5 w-1/3" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 p-3">
                <Alert tone="danger" title={t('loadFailed')}>
                    {error}
                </Alert>
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="flex flex-1 items-center px-4">
                <EmptyState size="sm" icon={<MessagesSquare />} title={t('noConversations')} />
            </div>
        );
    }

    return (
        <ul className="scrollbar-none flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {conversations.map((conv) => {
                const isClass = conv.type === 'CLASS';
                const name = conv.name || t('untitled');
                const active = selectedId === conv.id;
                const unread = opened.includes(conv.id) ? 0 : conv.unread_count ?? 0;
                const muted =
                    !!conv.muted_until && new Date(conv.muted_until).getTime() > Date.now();
                const preview = conv.last_message
                    ? `${conv.last_message.sender_id === me ? `${t('you')}: ` : ''}${conv.last_message.content}`
                    : null;

                return (
                    <li key={conv.id}>
                        <button
                            type="button"
                            aria-current={active ? 'true' : undefined}
                            onClick={() => handleSelect(conv)}
                            className={cn(
                                'flex w-full items-center gap-3 rounded-input px-2.5 py-2.5 text-left transition-colors',
                                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                active
                                    ? 'bg-primary-subtle text-primary-subtle-foreground'
                                    : 'text-foreground hover:bg-muted',
                            )}
                        >
                            {isClass ? (
                                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                                    <Users className="size-4" aria-hidden />
                                </span>
                            ) : (
                                <Avatar name={name} size="sm" />
                            )}

                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                        {name}
                                    </span>
                                    {conv.last_message && (
                                        <span className="numeric shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {timeLabel(conv.last_message.created_at)}
                                        </span>
                                    )}
                                </span>

                                <span className="mt-0.5 flex items-center gap-1.5">
                                    <span
                                        className={cn(
                                            'min-w-0 flex-1 truncate text-xs',
                                            unread > 0
                                                ? 'font-semibold text-foreground'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {preview ??
                                            (isClass ? t('classGroup') : t('directMessage'))}
                                    </span>

                                    {muted && (
                                        <VolumeX
                                            className="size-3 shrink-0 text-muted-foreground"
                                            aria-label={t('muted')}
                                        />
                                    )}

                                    {unread > 0 && (
                                        <Badge
                                            tone="primary"
                                            variant="solid"
                                            size="sm"
                                            className="shrink-0"
                                        >
                                            {unread}
                                        </Badge>
                                    )}
                                </span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
