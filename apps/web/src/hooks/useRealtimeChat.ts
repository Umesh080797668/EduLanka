import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { apiClient } from '@/lib/api-client';

export type Message = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_pinned?: boolean;
    sender_name?: string | null;
    sender_role?: string | null;
    sender_avatar_url?: string | null;
    read_by?: string[];
    is_read?: boolean;
};

export type ConnectionStatus = 'connecting' | 'socket' | 'polling' | 'disconnected';

interface MessagePage {
    conversationId: string;
    messages: Message[];
    hasMore: boolean;
}

const PAGE_SIZE = 50;

/**
 * socket.io treats a path in the URL as a namespace, so the gateway — which is
 * mounted on the API's HTTP server — has to be addressed by origin alone.
 */
function socketOrigin(): string {
    const raw = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8081';
    try {
        return new URL(raw).origin;
    } catch {
        return raw;
    }
}

/** Insert-or-merge by id: the socket echo and the POST reply race each other. */
function upsert(list: Message[], next: Message): Message[] {
    const index = list.findIndex((m) => m.id === next.id);
    if (index === -1) return [...list, next];
    const merged = list.slice();
    merged[index] = { ...list[index], ...next } as Message;
    return merged;
}

/**
 * Live view of one conversation.
 *
 * History comes from the cookie-authenticated REST API rather than a direct
 * Postgres read, so it works for every role without a Supabase session. The
 * socket is used purely as an inbound transport; sending goes over HTTP so a
 * refusal (muted, not a participant) surfaces as a real error.
 *
 * Falls back to 4s HTTP polling if the WebSocket drops or fails to connect.
 *
 * Callers should key the component by `conversationId` — this hook does not
 * reset itself when the id changes.
 */
export function useRealtimeChat(conversationId: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [typingUserIds, setTypingUserIds] = useState<string[]>([]);

    const socketRef = useRef<Socket | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const typingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    useEffect(() => {
        let isMounted = true;

        const stopPollingFallback = () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };

        const engagePollingFallback = () => {
            if (pollIntervalRef.current) return;
            if (isMounted) setConnectionStatus('polling');
            pollIntervalRef.current = setInterval(async () => {
                if (!isMounted) return;
                try {
                    const page = await apiClient.get<MessagePage>(
                        `/chat/conversations/${conversationId}/messages?limit=25`,
                        { skipGlobalToast: true },
                    );
                    if (isMounted && page?.messages) {
                        setMessages((prev) => {
                            let next = prev;
                            for (const msg of page.messages) {
                                next = upsert(next, msg);
                            }
                            return next;
                        });
                    }
                } catch {
                    // Ignore polling errors quietly
                }
            }, 4000);
        };

        const start = async () => {
            try {
                const page = await apiClient.get<MessagePage>(
                    `/chat/conversations/${conversationId}/messages?limit=${PAGE_SIZE}`,
                    { skipGlobalToast: true },
                );
                if (isMounted) {
                    setMessages(page?.messages ?? []);
                    setHasMore(!!page?.hasMore);
                }
            } catch (err: any) {
                if (isMounted) setHistoryError(err?.message ?? null);
            } finally {
                if (isMounted) setLoadingHistory(false);
            }

            // The gateway verifies the handshake against JWT_SECRET, and the
            // session cookie is httpOnly and cross-origin to it. `auth` as a
            // function runs before every attempt, so reconnects re-ticket too.
            const socket = io(socketOrigin(), {
                auth: (cb: (data: Record<string, unknown>) => void) => {
                    apiClient
                        .get<{ token: string }>('/chat/socket-ticket', { skipGlobalToast: true })
                        .then((ticket) => cb({ token: ticket?.token ?? '' }))
                        .catch(() => cb({}));
                },
                transports: ['websocket'],
                reconnectionAttempts: 3,
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                if (isMounted) {
                    stopPollingFallback();
                    setConnectionStatus('socket');
                    socket.emit('join_conversation', { conversationId });
                }
            });

            socket.io.on('reconnect', () => {
                if (isMounted) {
                    stopPollingFallback();
                    setConnectionStatus('socket');
                    socket.emit('join_conversation', { conversationId });
                }
            });

            socket.on('new_message', (msg: Message) => {
                if (msg?.conversation_id === conversationId && isMounted) {
                    setMessages((prev) => upsert(prev, msg));
                }
            });

            socket.on('message_read', (data: { conversationId: string; messageId: string; userId: string }) => {
                if (data?.conversationId === conversationId && isMounted) {
                    setMessages((prev) =>
                        prev.map((m) => {
                            if (m.id === data.messageId) {
                                const readBy = new Set(m.read_by || []);
                                readBy.add(data.userId);
                                return {
                                    ...m,
                                    read_by: Array.from(readBy),
                                    is_read: true,
                                };
                            }
                            return m;
                        }),
                    );
                }
            });

            socket.on('user_typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
                if (data?.conversationId !== conversationId || !data.userId || !isMounted) return;

                const existingTimer = typingTimersRef.current.get(data.userId);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                    typingTimersRef.current.delete(data.userId);
                }

                if (data.isTyping) {
                    setTypingUserIds((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
                    const timer = setTimeout(() => {
                        if (isMounted) {
                            setTypingUserIds((prev) => prev.filter((id) => id !== data.userId));
                        }
                        typingTimersRef.current.delete(data.userId);
                    }, 3000);
                    typingTimersRef.current.set(data.userId, timer);
                } else {
                    setTypingUserIds((prev) => prev.filter((id) => id !== data.userId));
                }
            });

            socket.on('disconnect', () => {
                if (isMounted) {
                    setConnectionStatus('connecting');
                    engagePollingFallback();
                }
            });

            socket.on('connect_error', () => {
                engagePollingFallback();
            });

            socket.io.on('reconnect_failed', () => {
                engagePollingFallback();
            });
        };

        start();

        return () => {
            isMounted = false;
            stopPollingFallback();
            typingTimersRef.current.forEach((t) => clearTimeout(t));
            typingTimersRef.current.clear();
            socketRef.current?.emit('leave_conversation', { conversationId });
            socketRef.current?.disconnect();
            socketRef.current = null;
        };
    }, [conversationId]);

    const oldestAt = messages.length > 0 ? messages[0]!.created_at : null;

    /** Walk one page further back from the oldest message currently held. */
    const loadOlder = useCallback(async () => {
        if (!oldestAt) return;
        setLoadingOlder(true);
        try {
            const page = await apiClient.get<MessagePage>(
                `/chat/conversations/${conversationId}/messages?limit=${PAGE_SIZE}&before=${encodeURIComponent(oldestAt)}`,
                { skipGlobalToast: true },
            );
            const older = page?.messages ?? [];
            if (older.length > 0) {
                setMessages((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    return [...older.filter((m) => !seen.has(m.id)), ...prev];
                });
            }
            setHasMore(!!page?.hasMore);
        } finally {
            setLoadingOlder(false);
        }
    }, [conversationId, oldestAt]);

    const sendMessage = useCallback(
        async (content: string) => {
            const msg = await apiClient.post<Message>(
                '/chat/messages',
                { conversationId, content },
                { skipGlobalToast: true },
            );
            // The gateway echoes this to everyone including us, but appending the
            // server's copy immediately keeps the composer feeling instant.
            if (msg?.id) setMessages((prev) => upsert(prev, msg));
        },
        [conversationId],
    );

    /** Reflect a successful pin/unpin without refetching the page. */
    const setPinned = useCallback((messageId: string, isPinned: boolean) => {
        setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, is_pinned: isPinned } : m)),
        );
    }, []);

    const sendTyping = useCallback(
        (isTyping: boolean) => {
            socketRef.current?.emit('typing', { conversationId, isTyping });
        },
        [conversationId],
    );

    return {
        messages,
        connectionStatus,
        sendMessage,
        loadingHistory,
        historyError,
        hasMore,
        loadingOlder,
        loadOlder,
        setPinned,
        typingUserIds,
        sendTyping,
    };
}
