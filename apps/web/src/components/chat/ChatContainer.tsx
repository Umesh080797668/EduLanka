"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';

export default function ChatContainer() {
    const t = useTranslations('Chat');
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

    return (
        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background border-t border-border">
            <aside className="w-80 border-r border-border bg-card flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-border shadow-sm z-10">
                    <h2 className="text-xl font-semibold tracking-tight">{t('conversations')}</h2>
                </div>
                <ConversationList
                    selectedId={selectedConversationId}
                    onSelect={setSelectedConversationId}
                />
            </aside>

            <main className="flex-1 flex flex-col bg-background relative overflow-hidden">
                {selectedConversationId ? (
                    <MessageThread conversationId={selectedConversationId} />
                ) : (
                    <div className="flex flex-1 items-center justify-center flex-col text-muted-foreground animate-in fade-in duration-500">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="text-lg font-medium">{t('selectConversationToStart')}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
