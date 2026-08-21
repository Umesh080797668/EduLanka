import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export type Message = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_pinned: boolean;
    chat_read_receipts?: any[];
};

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

export function useRealtimeChat(tenantId: string, conversationId: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<
        'connecting' | 'socket' | 'supabase' | 'disconnected'
    >('connecting');
    const socketRef = useRef<Socket | null>(null);
    const supabase = createSupabaseBrowserClient();
    const supabaseChannelRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;

        const setupSupabaseFallback = () => {
            if (supabaseChannelRef.current) return; // Already running

            const channel = supabase
                .channel(`chat_${conversationId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'chat_messages',
                        filter: `conversation_id=eq.${conversationId}`,
                    },
                    (payload) => {
                        if (isMounted) {
                            setMessages((prev) => {
                                if (prev.find((m) => m.id === payload.new.id)) return prev;
                                return [...prev, payload.new as Message];
                            });
                        }
                    },
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED' && isMounted) {
                        setConnectionStatus('supabase');
                    }
                });
            supabaseChannelRef.current = channel;
        };

        const initializeChat = async () => {
            // 1. Historical messages. Read directly from Postgres when a Supabase
            //    session exists; a missing session is not fatal to live delivery.
            try {
                const { data: initialMessages } = await supabase
                    .from('chat_messages')
                    .select('*, chat_read_receipts(id, user_id)')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (isMounted && initialMessages) setMessages(initialMessages);
            } catch {
                // History is best-effort — realtime still works without it.
            }

            // 2. Primary driver: Socket.io. The gateway verifies the handshake
            //    token against JWT_SECRET, so it must be the NestJS session
            //    token — a Supabase access_token fails signature checks.
            const token = authManager.getToken();
            if (!token) {
                if (isMounted) setConnectionStatus('disconnected');
                return;
            }

            const socket = io(socketOrigin(), {
                auth: { token },
                transports: ['websocket'],
                reconnectionAttempts: 3, // Fail over to Supabase if the VPS WebSocket layer fails
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                if (isMounted) setConnectionStatus('socket');
            });

            socket.on('new_message', (msg: Message) => {
                if (msg.conversation_id === conversationId && isMounted) {
                    setMessages((prev) => {
                        // Prevent duplicates if the REST request returned quickly
                        if (prev.find((m) => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                }
            });

            socket.on('disconnect', () => {
                if (isMounted) setConnectionStatus('connecting');
            });

            socket.on('connect_error', () => {
                // Dual driver fallback strategy: engage Supabase Realtime
                if (isMounted) {
                    setConnectionStatus('supabase');
                    setupSupabaseFallback();
                }
            });
        };

        initializeChat();

        return () => {
            isMounted = false;
            if (socketRef.current) socketRef.current.disconnect();
            if (supabaseChannelRef.current) supabase.removeChannel(supabaseChannelRef.current);
        };
    }, [tenantId, conversationId, supabase]);

    const sendMessage = async (content: string) => {
        if (connectionStatus === 'socket' && socketRef.current) {
            socketRef.current.emit('send_message', { conversationId, content });
            return;
        }

        // Fallback REST endpoint. Goes through apiClient so it uses cookie auth
        // and throws on failure, letting the composer surface an error.
        const msg = await apiClient.post<Message>(
            '/chat/messages',
            { conversationId, content },
            { skipGlobalToast: true },
        );

        // No socket echo on this path, so append the server's copy ourselves.
        if (msg?.id) {
            setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
        }
    };

    return { messages, connectionStatus, sendMessage };
}
