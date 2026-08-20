import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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

export function useRealtimeChat(tenantId: string, conversationId: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'socket' | 'supabase' | 'disconnected'>('connecting');
    const socketRef = useRef<Socket | null>(null);
    const supabase = createSupabaseBrowserClient();
    const supabaseChannelRef = useRef<any>(null);

    useEffect(() => {
        let isMounted = true;

        const initializeChat = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const token = session.access_token;

            // 1. Fetch initial historical messages with read receipts
            const { data: initialMessages } = await supabase
                .from('chat_messages')
                .select('*, chat_read_receipts(id, user_id)')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true })
                .limit(50);

            if (isMounted && initialMessages) setMessages(initialMessages);

            // 2. Try Primary Driver: Socket.io
            const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const socket = io(socketUrl, {
                auth: { token },
                transports: ['websocket'],
                reconnectionAttempts: 3 // Fail over to Supabase after 3 tries if VPS WebSocket layer fails
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                if (isMounted) setConnectionStatus('socket');
            });

            socket.on('new_message', (msg: Message) => {
                if (msg.conversation_id === conversationId && isMounted) {
                    setMessages(prev => {
                        // Prevent duplicates if REST request returned quickly
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                }
            });

            socket.on('disconnect', () => {
                if (isMounted) setConnectionStatus('connecting');
            });

            socket.on('connect_error', () => {
                // Dual Driver Fallback Strategy: Engage Supabase Realtime
                if (isMounted) {
                    setConnectionStatus('supabase');
                    setupSupabaseFallback();
                }
            });
        };

        const setupSupabaseFallback = () => {
            if (supabaseChannelRef.current) return; // Already running

            const channel = supabase.channel(`chat_${conversationId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`
                }, (payload) => {
                    if (isMounted) {
                        setMessages(prev => {
                            if (prev.find(m => m.id === payload.new.id)) return prev;
                            return [...prev, payload.new as Message];
                        });
                    }
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED' && isMounted) {
                        setConnectionStatus('supabase');
                    }
                });
            supabaseChannelRef.current = channel;
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
        } else {
            // Fallback REST endpoint protected by ThrottlerGuard
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/chat/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ conversationId, content })
            });
        }
    };

    return { messages, connectionStatus, sendMessage };
}
