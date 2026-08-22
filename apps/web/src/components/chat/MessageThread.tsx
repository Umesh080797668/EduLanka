'use client';

import * as React from 'react';
import { ChevronUp, Pin, Send, Users, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import ModerationTools from './ModerationTools';
import type { Conversation, Participant } from './types';

/** Connection quality is surfaced as a dot + label rather than raw driver names. */
const CONNECTION: Record<
    string,
    { tone: string; key: 'connSocket' | 'connFallback' | 'connConnecting' | 'connDisconnected' }
> = {
    socket: { tone: 'bg-success', key: 'connSocket' },
    supabase: { tone: 'bg-warning', key: 'connFallback' },
    disconnected: { tone: 'bg-destructive', key: 'connDisconnected' },
};

export default function MessageThread({ conversation }: { conversation: Conversation }) {
    const t = useTranslations('Chat');
    const conversationId = conversation.id;

    // `sub` in every JWT is `public.users.id`, which is also what the API stamps
    // onto `chat_messages.sender_id` — so this is the right key for "mine".
    const [me] = React.useState(() => authManager.getUserId() || '');
    const [inputText, setInputText] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [membersOpen, setMembersOpen] = React.useState(false);
    const [members, setMembers] = React.useState<Participant[] | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const readRef = React.useRef<Set<string>>(new Set());
    const lastIdRef = React.useRef<string | null>(null);

    const {
        messages,
        connectionStatus,
        sendMessage,
        loadingHistory,
        historyError,
        hasMore,
        loadingOlder,
        loadOlder,
        setPinned,
    } = useRealtimeChat(conversationId);

    React.useEffect(() => {
        // Only chase the bottom when something arrived at the *end*; prepending an
        // older page must leave the reader where they were.
        const lastId = messages.length > 0 ? messages[messages.length - 1]!.id : null;
        if (lastId !== lastIdRef.current) {
            lastIdRef.current = lastId;
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        // Acknowledge inbound messages once each — the receipt endpoint is
        // cookie-authenticated like every other API call.
        messages.forEach((msg) => {
            if (msg.sender_id === me || readRef.current.has(msg.id)) return;
            readRef.current.add(msg.id);
            apiClient
                .post(`/chat/messages/${msg.id}/read`, {}, { skipGlobalToast: true })
                .catch(() => readRef.current.delete(msg.id));
        });
    }, [messages, me]);

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

    const openMembers = async () => {
        setMembersOpen(true);
        if (members) return; // roster is cheap to keep for the session
        try {
            const roster = await apiClient.get<Participant[]>(
                `/chat/conversations/${conversationId}/participants`,
                { skipGlobalToast: true },
            );
            setMembers(Array.isArray(roster) ? roster : []);
        } catch {
            setMembers([]);
        }
    };

    const conn = CONNECTION[connectionStatus];
    const title = conversation.name || t('untitled');
    // Class rosters and ad-hoc groups both read as group threads.
    const isGroup = conversation.type !== 'DIRECT';

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            {/* ── Thread header ─────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
                <div className="flex min-w-0 items-center gap-3">
                    {isGroup ? (
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                            <Users className="size-4" aria-hidden />
                        </span>
                    ) : (
                        <Avatar name={title} size="sm" />
                    )}
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold tracking-tight text-foreground">
                            {title}
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
                </div>

                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('viewMembers')}
                    title={t('viewMembers')}
                    onClick={openMembers}
                >
                    <Users className="size-4" />
                </Button>
            </header>

            {/* ── Messages ──────────────────────────────────────────────────── */}
            <div
                ref={scrollRef}
                className="scrollbar-none flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto bg-muted/25 p-4"
            >
                {loadingHistory ? (
                    <div className="space-y-3">
                        {[70, 55, 80, 45].map((width, idx) => (
                            <Skeleton
                                key={idx}
                                style={{ width: `${width}%` }}
                                className={cn('h-14 rounded-card', idx % 2 === 1 && 'ml-auto')}
                            />
                        ))}
                    </div>
                ) : historyError ? (
                    <Alert tone="danger" title={t('loadFailed')}>
                        {historyError}
                    </Alert>
                ) : messages.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                        <EmptyState
                            size="sm"
                            icon={<Send />}
                            title={t('noMessages')}
                            description={t('noMessagesDesc')}
                        />
                    </div>
                ) : (
                    <>
                        {hasMore && (
                            <div className="mb-2 flex justify-center">
                                <Button
                                    variant="subtle"
                                    size="xs"
                                    leadingIcon={<ChevronUp />}
                                    loading={loadingOlder}
                                    onClick={() => void loadOlder()}
                                >
                                    {t('loadOlder')}
                                </Button>
                            </div>
                        )}

                        {messages.map((msg, idx) => {
                            const isMe = msg.sender_id === me;
                            const isRead = !!msg.is_read;
                            const prev = idx > 0 ? messages[idx - 1] : undefined;
                            // A run of messages from one sender gets a single
                            // avatar and name, like every messenger the parents
                            // already use.
                            const startsGroup = !prev || prev.sender_id !== msg.sender_id;

                            return (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        'flex items-end gap-2',
                                        isMe ? 'justify-end' : 'justify-start',
                                        startsGroup && idx > 0 && 'mt-2',
                                    )}
                                >
                                    {!isMe && (
                                        <span className="w-6 shrink-0 self-end">
                                            {startsGroup && (
                                                <Avatar
                                                    size="xs"
                                                    name={msg.sender_name || undefined}
                                                    src={msg.sender_avatar_url || undefined}
                                                />
                                            )}
                                        </span>
                                    )}

                                    <div
                                        className={cn(
                                            'group relative max-w-[80%] rounded-card px-4 py-3 shadow-xs sm:max-w-[70%]',
                                            isMe
                                                ? 'rounded-br-sm bg-primary text-primary-foreground'
                                                : 'rounded-bl-sm border border-border bg-card text-card-foreground',
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

                                        {!isMe && startsGroup && msg.sender_name && (
                                            <p className="mb-1 truncate pr-7 text-xs font-bold text-primary">
                                                {msg.sender_name}
                                            </p>
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
                                            isPinned={!!msg.is_pinned}
                                            senderId={msg.sender_id}
                                            conversationId={conversationId}
                                            isMe={isMe}
                                            onPinned={(next) => setPinned(msg.id, next)}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* ── Composer ──────────────────────────────────────────────────── */}
            <footer id="chat-composer" className="shrink-0 border-t border-border bg-card p-3">
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

            {/* ── Roster ────────────────────────────────────────────────────── */}
            <Dialog
                open={membersOpen}
                onClose={() => setMembersOpen(false)}
                title={t('members')}
                description={title}
                icon={<Users />}
                size="sm"
            >
                {members === null ? (
                    <Spinner text={t('loading')} />
                ) : members.length === 0 ? (
                    <EmptyState size="sm" icon={<Users />} title={t('noMembers')} />
                ) : (
                    <ul className="divide-y divide-border">
                        {members.map((p) => (
                            <li key={p.id} className="flex items-center gap-3 py-2.5">
                                <Avatar
                                    size="sm"
                                    name={p.full_name || undefined}
                                    src={p.avatar_url || undefined}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {p.full_name || t('untitled')}
                                        {p.user_id === me && (
                                            <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                                                ({t('you')})
                                            </span>
                                        )}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {p.role === 'MODERATOR' ? t('moderator') : t('member')}
                                    </p>
                                </div>
                                {p.is_muted && (
                                    <Badge tone="warning" size="sm" className="shrink-0">
                                        <VolumeX className="size-3" />
                                        {t('muted')}
                                    </Badge>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Dialog>
        </div>
    );
}
