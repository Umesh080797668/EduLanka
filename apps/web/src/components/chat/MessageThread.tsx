'use client';

import * as React from 'react';
import { Pin, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';
import { Spinner } from '@/components/ui/Spinner';
import ModerationTools from './ModerationTools';

/** Connection quality is surfaced as a dot + label rather than raw driver names. */
const CONNECTION: Record<string, { tone: string; key: 'connSocket' | 'connFallback' | 'connConnecting' }> = {
    socket: { tone: 'bg-success', key: 'connSocket' },
    supabase: { tone: 'bg-warning', key: 'connFallback' },
};

export default function MessageThread({ conversationId }: { conversationId: string }) {
    const t = useTranslations('Chat');
    const supabase = createSupabaseBrowserClient();
    // Fall back to the NestJS session so the thread still identifies "me"
    // when the Supabase client has no session of its own.
    const [tenantId, setTenantId] = React.useState(() => authManager.getTenantId() || '');
    const [userId, setUserId] = React.useState(() => authManager.getUserId() || '');
    const [inputText, setInputText] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const readRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (!data.session) return;
            const user = data.session.user;
            const tId =
                (user as any).app_metadata?.tenantId || user.user_metadata?.tenantId;
            if (tId) setTenantId(tId);
            setUserId(user.id);
        });
    }, [supabase]);

    const { messages, connectionStatus, sendMessage } = useRealtimeChat(
        tenantId,
        conversationId,
    );

    React.useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;

        // Acknowledge inbound messages once each — the receipt endpoint is
        // cookie-authenticated like every other API call.
        messages.forEach((msg) => {
            if (msg.sender_id === userId || readRef.current.has(msg.id)) return;
            readRef.current.add(msg.id);
            apiClient
                .post(`/chat/messages/${msg.id}/read`, {}, { skipGlobalToast: true })
                .catch(() => readRef.current.delete(msg.id));
        });
    }, [messages, userId]);

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || sending) return;
        setSending(true);
        try {
            await sendMessage(text);
            setInputText('');
        } catch (err: any) {
            toast.error(t('sendFailed'), { description: err?.message });
        } finally {
            setSending(false);
        }
    };

    if (!tenantId) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Spinner text={t('loading')} />
            </div>
        );
    }

    const conn = CONNECTION[connectionStatus];

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            {/* ── Thread header ─────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
                <div className="min-w-0">
                    <h2 className="truncate text-base font-bold tracking-tight text-foreground">
                        {t('conversationThread')}
                    </h2>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                            aria-hidden
                            className={cn(
                                'size-2 shrink-0 rounded-full',
                                conn ? conn.tone : 'bg-muted-foreground',
                                !conn && 'animate-pulse',
                            )}
                        />
                        {t(conn?.key ?? 'connConnecting')}
                    </p>
                </div>
            </header>

            {/* ── Messages ──────────────────────────────────────────────────── */}
            <div
                ref={scrollRef}
                className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/25 p-4"
            >
                {messages.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                        <EmptyState
                            size="sm"
                            icon={<Send />}
                            title={t('noMessages')}
                            description={t('noMessagesDesc')}
                        />
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === userId;
                        const isRead =
                            !!msg.chat_read_receipts && msg.chat_read_receipts.length > 0;

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    'group relative max-w-[80%] rounded-card px-4 py-3 shadow-xs sm:max-w-[70%]',
                                    isMe
                                        ? 'ml-auto self-end rounded-br-sm bg-primary text-primary-foreground'
                                        : 'self-start rounded-bl-sm border border-border bg-card text-card-foreground',
                                )}
                            >
                                {msg.is_pinned && (
                                    <Badge
                                        tone="warning"
                                        size="sm"
                                        variant="solid"
                                        className="mb-2"
                                    >
                                        <Pin className="size-3" />
                                        {t('pinnedMessage')}
                                    </Badge>
                                )}

                                <p className="whitespace-pre-wrap break-words pr-7 text-[15px] leading-relaxed">
                                    {msg.content}
                                </p>

                                <p
                                    className={cn(
                                        'mt-1.5 flex items-center justify-end gap-1 text-[10px] font-bold',
                                        isMe
                                            ? 'text-primary-foreground/70'
                                            : 'text-muted-foreground',
                                    )}
                                >
                                    <span className="numeric">
                                        {new Date(msg.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    {isMe && (
                                        <span
                                            title={isRead ? t('read') : t('delivered')}
                                            className={
                                                isRead
                                                    ? 'text-primary-foreground'
                                                    : 'text-primary-foreground/45'
                                            }
                                        >
                                            {isRead ? '✓✓' : '✓'}
                                        </span>
                                    )}
                                </p>

                                <ModerationTools
                                    messageId={msg.id}
                                    isPinned={msg.is_pinned}
                                    senderId={msg.sender_id}
                                    conversationId={conversationId}
                                    isMe={isMe}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Composer ──────────────────────────────────────────────────── */}
            <footer className="shrink-0 border-t border-border bg-card p-3">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="flex items-center gap-2"
                >
                    <Input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={t('typeAMessage')}
                        aria-label={t('typeAMessage')}
                        autoComplete="off"
                        className="flex-1"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        aria-label={t('send')}
                        title={t('send')}
                        loading={sending}
                        disabled={!inputText.trim()}
                    >
                        <Send className="size-4" />
                    </Button>
                </form>
            </footer>
        </div>
    );
}
