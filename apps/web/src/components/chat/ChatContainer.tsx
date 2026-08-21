'use client';

import * as React from 'react';
import { ChevronLeft, MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Layout';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';

/**
 * Two-pane messaging shell. On phones the panes swap: the list fills the screen
 * until a conversation is chosen, and a back button returns to it.
 */
export default function ChatContainer() {
    const t = useTranslations('Chat');
    const [selectedId, setSelectedId] = React.useState<string | null>(null);

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden border-t border-border bg-background">
            {/* ── Conversations ─────────────────────────────────────────────── */}
            <aside
                className={`${selectedId ? 'hidden' : 'flex'} w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-80`}
            >
                <div className="shrink-0 border-b border-border px-4 py-3.5">
                    <h1 className="text-base font-bold tracking-tight text-foreground">
                        {t('conversations')}
                    </h1>
                </div>
                <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
            </aside>

            {/* ── Thread ────────────────────────────────────────────────────── */}
            <main
                className={`${selectedId ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}
            >
                {selectedId ? (
                    <>
                        <div className="shrink-0 border-b border-border bg-card px-3 py-2 md:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<ChevronLeft />}
                                onClick={() => setSelectedId(null)}
                            >
                                {t('backToList')}
                            </Button>
                        </div>
                        <div className="min-h-0 flex-1">
                            <MessageThread conversationId={selectedId} />
                        </div>
                    </>
                ) : (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <EmptyState
                            icon={<MessagesSquare />}
                            title={t('selectConversationToStart')}
                        />
                    </div>
                )}
            </main>
        </div>
    );
}
