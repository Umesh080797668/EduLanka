"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { useTranslations } from 'next-intl';
import ModerationTools from './ModerationTools';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function MessageThread({ conversationId }: { conversationId: string }) {
    const [tenantId, setTenantId] = useState('');
    const [userId, setUserId] = useState('');
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                const tId = (data.session.user as any).app_metadata?.tenantId || data.session.user.user_metadata?.tenantId;
                setTenantId(tId || 'demo');
                setUserId(data.session.user.id);
            }
        });
    }, [supabase]);

    const { messages, connectionStatus, sendMessage } = useRealtimeChat(tenantId, conversationId);
    const [inputText, setInputText] = useState('');
    const t = useTranslations('Chat');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;

        // Auto-mark as read
        messages.forEach(async msg => {
            if (msg.sender_id !== userId) {
                const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    fetch(`${apiBaseUrl}/api/v1/chat/messages/${msg.id}/read`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    }).catch(() => null);
                }
            }
        });
    }, [messages, supabase, userId]);

    const handleSend = async () => {
        if (!inputText.trim()) return;
        await sendMessage(inputText);
        setInputText('');
    };

    if (!tenantId) return <div className="flex-1 flex justify-center items-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="flex flex-col h-full bg-background relative">
            <header className="p-4 border-b border-border bg-card/80 backdrop-blur-sm flex justify-between items-center shadow-sm z-10 sticky top-0">
                <div>
                    <h3 className="font-semibold text-lg text-foreground tracking-tight">{t('conversationThread')}</h3>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${connectionStatus === 'socket' ? 'bg-green-500' : connectionStatus === 'supabase' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                        {connectionStatus === 'socket' ? 'Lightning Mode (Socket.io)' : connectionStatus === 'supabase' ? 'Fallback DB Polling' : 'Connecting...'}
                    </span>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20" ref={scrollRef}>
                {messages.map(msg => {
                    const isMe = msg.sender_id === userId;
                    const isRead = msg.chat_read_receipts && msg.chat_read_receipts.length > 0;
                    return (
                        <div key={msg.id} className={`flex flex-col max-w-[75%] rounded-2xl p-4 shadow-sm border border-border/50 relative overflow-hidden group transition-all duration-300 transform translate-y-0 opacity-100 ${isMe ? 'bg-primary text-primary-foreground self-end rounded-tr-sm ml-auto' : 'bg-card text-card-foreground self-start rounded-tl-sm'}`}>
                            {msg.is_pinned && (
                                <div className="absolute top-0 left-0 w-full h-1">
                                    <div className="h-full bg-yellow-400"></div>
                                </div>
                            )}
                            <span className="text-[15px] font-medium leading-relaxed z-10 block pr-6 relative">{msg.content}</span>
                            <span className={`text-[10px] self-end mt-2 z-10 font-bold flex items-center gap-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {new Date(msg.created_at).toLocaleTimeString()}
                                {isMe && (
                                    <span className={isRead ? 'text-blue-300 tracking-tighter' : 'text-primary-foreground/40'}>
                                        {isRead ? '✓✓' : '✓'}
                                    </span>
                                )}
                            </span>
                            <ModerationTools messageId={msg.id} isPinned={msg.is_pinned} senderId={msg.sender_id} conversationId={conversationId} isMe={isMe} />
                        </div>
                    )
                })}
            </div>

            <footer className="p-4 border-t border-border bg-card shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <div className="flex items-center space-x-3">
                    <input
                        className="flex h-12 w-full rounded-full border border-input/50 bg-background hover:bg-muted/30 transition-colors px-6 py-2 text-[15px] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={t('typeAMessage')}
                    />
                    <button
                        onClick={handleSend}
                        className="inline-flex items-center justify-center rounded-full text-sm font-semibold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary h-12 w-12 px-0 py-0 shadow-md"
                    >
                        &rarr;
                    </button>
                </div>
            </footer>
        </div>
    );
}
