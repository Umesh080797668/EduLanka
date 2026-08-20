"use client";

import React, { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

export default function ConversationList({ selectedId, onSelect }: { selectedId: string | null, onSelect: (id: string) => void }) {
    const supabase = createSupabaseBrowserClient();
    const t = useTranslations('Chat');
    const [conversations, setConversations] = useState<any[]>([]);

    useEffect(() => {
        let isMounted = true;

        async function fetchConversations() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data } = await supabase.from('chat_participants')
                .select('conversation_id, chat_conversations(name, type)')
                .eq('user_id', session.user.id);

            if (data && isMounted) {
                setConversations(data.map(d => ({ id: d.conversation_id, ...d.chat_conversations })));
            }
        }
        fetchConversations();
        return () => { isMounted = false; }
    }, [supabase]);

    return (
        <div className="flex flex-col flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">{t('noConversations')}</div>
            ) : (
                conversations.map(conv => (
                    <button
                        key={conv.id}
                        onClick={() => onSelect(conv.id)}
                        className={`w-full text-left flex flex-col p-4 border-b border-border hover:bg-muted/50 transition-colors ${selectedId === conv.id ? 'bg-muted' : ''}`}
                    >
                        <span className="font-medium text-sm text-foreground">{conv.name || t('untitled')}</span>
                        <span className="text-xs text-primary/80 font-semibold mt-1 uppercase tracking-wider">{conv.type === 'CLASS' ? t('classGroup') : t('directMessage')}</span>
                    </button>
                ))
            )}
        </div>
    );
}
