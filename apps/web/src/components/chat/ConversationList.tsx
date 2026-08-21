'use client';

import * as React from 'react';
import { MessagesSquare, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';

interface ConversationListProps {
    selectedId: string | null;
    onSelect: (id: string) => void;
}

export default function ConversationList({ selectedId, onSelect }: ConversationListProps) {
    const supabase = createSupabaseBrowserClient();
    const t = useTranslations('Chat');
    const [conversations, setConversations] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let isMounted = true;

        async function fetchConversations() {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session) return;

                const { data } = await supabase
                    .from('chat_participants')
                    .select('conversation_id, chat_conversations(name, type)')
                    .eq('user_id', session.user.id);

                if (data && isMounted) {
                    setConversations(
                        data.map((d) => ({ id: d.conversation_id, ...d.chat_conversations })),
                    );
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchConversations();
        return () => {
            isMounted = false;
        };
    }, [supabase]);

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

                return (
                    <li key={conv.id}>
                        <button
                            type="button"
                            aria-current={active ? 'true' : undefined}
                            onClick={() => onSelect(conv.id)}
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
                                <span className="block truncate text-sm font-semibold">
                                    {name}
                                </span>
                                <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    {isClass ? t('classGroup') : t('directMessage')}
                                </span>
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
