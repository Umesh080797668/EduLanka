"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function ModerationTools({ messageId, isPinned, senderId, conversationId, isMe }: any) {
    const t = useTranslations('Moderation');
    const supabase = createSupabaseBrowserClient();

    const handlePin = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        await fetch(`${apiBaseUrl}/api/v1/chat/messages/${messageId}/pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ messageId, isPinned: !isPinned })
        });
    };

    const handleMute = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        await fetch(`${apiBaseUrl}/api/v1/chat/participants/mute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ conversationId, participantUserId: senderId, durationMinutes: 60 })
        });
        alert('User temporarily muted.');
    };

    if (isMe) return null; // Don't allow muting/pinning own easily for demo

    return (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 px-2 py-1 rounded-full z-20">
            <button onClick={handlePin} className="text-[10px] uppercase font-bold text-foreground/80 hover:text-primary transition-colors hover:scale-105 active:scale-95">
                {isPinned ? t('unpin') : t('pin')}
            </button>
            <button onClick={handleMute} className="text-[10px] uppercase font-bold text-destructive hover:text-red-500 transition-colors hover:scale-105 active:scale-95 pl-2 border-l border-foreground/20">
                {t('muteUser')}
            </button>
        </div>
    );
}
