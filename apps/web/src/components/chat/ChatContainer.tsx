'use client';

import * as React from 'react';
import { ChevronLeft, MessagesSquare, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Layout';
import ConversationList from './ConversationList';
import MessageThread from './MessageThread';
import NewConversationDialog from './NewConversationDialog';
import type { Conversation } from './types';

/**
 * Two-pane messaging shell. On phones the panes swap: the list fills the screen
 * until a conversation is chosen, and a back button returns to it.
 */
export default function ChatContainer() {
    const t = useTranslations('Chat');
    const [selected, setSelected] = React.useState<Conversation | null>(null);
    const [composing, setComposing] = React.useState(false);
    // Bumped after a new thread is created so the inbox re-pulls immediately
    // instead of waiting out its refresh interval.
    const [refreshToken, setRefreshToken] = React.useState(0);

    const handleCreated = (conversation: Conversation) => {
        setSelected(conversation);
        setRefreshToken((token) => token + 1);
    };

    return (
        <div className="flex h-full min-h-0 w-full overflow-hidden border-t border-border bg-background">
            {/* ── Conversations ─────────────────────────────────────────────── */}
            <aside
                id="chat-conversation-list"
                className={`${selected ? 'hidden' : 'flex'} w-full shrink-0 flex-col border-r border-border bg-card md:flex md:w-80`}
            >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <h1 className="text-base font-bold tracking-tight text-foreground">
                        {t('conversations')}
                    </h1>
                    <Button
                        id="chat-new-conversation"
                        variant="subtle"
                        size="icon-sm"
                        aria-label={t('newConversation')}
                        title={t('newConversation')}
                        onClick={() => setComposing(true)}
                    >
                        <Plus className="size-4" />
                    </Button>
                </div>
                <ConversationList
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                    refreshToken={refreshToken}
                />
            </aside>

            {/* ── Thread ────────────────────────────────────────────────────── */}
            <main
                className={`${selected ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}
            >
                {selected ? (
                    <>
                        <div className="shrink-0 border-b border-border bg-card px-3 py-2 md:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={<ChevronLeft />}
                                onClick={() => setSelected(null)}
                            >
                                {t('backToList')}
                            </Button>
                        </div>
                        <div className="min-h-0 flex-1">
                            {/* Keyed so switching threads starts the hook clean. */}
                            <MessageThread key={selected.id} conversation={selected} />
                        </div>
                    </>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
                        <EmptyState
                            icon={<MessagesSquare />}
                            title={t('selectConversationToStart')}
                            action={
                                <Button
                                    leadingIcon={<Plus />}
                                    onClick={() => setComposing(true)}
                                >
                                    {t('newConversation')}
                                </Button>
                            }
                        />
                    </div>
                )}
            </main>

            <NewConversationDialog
                open={composing}
                onClose={() => setComposing(false)}
                onCreated={handleCreated}
            />
        </div>
    );
}
