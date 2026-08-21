'use client';

import * as React from 'react';
import { MoreHorizontal, Pin, PinOff, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

interface ModerationToolsProps {
    messageId: string;
    isPinned: boolean;
    senderId: string;
    conversationId: string;
    isMe: boolean;
    /** Called after a successful pin/unpin so the thread can update its copy. */
    onPinned?: (isPinned: boolean) => void;
}

/**
 * Per-message moderator actions. Rendered on hover/focus inside a message
 * bubble; the API rejects the call when the caller lacks the privilege, so the
 * buttons stay visible and simply report the refusal.
 */
export default function ModerationTools({
    messageId,
    isPinned,
    senderId,
    conversationId,
    isMe,
    onPinned,
}: ModerationToolsProps) {
    const t = useTranslations('Moderation');
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    if (isMe) return null;

    const handlePin = async () => {
        setBusy(true);
        try {
            await apiClient.post(`/chat/messages/${messageId}/pin`, {
                messageId,
                isPinned: !isPinned,
            }, { skipGlobalToast: true });
            onPinned?.(!isPinned);
            toast.success(isPinned ? t('unpinned') : t('pinned'));
            setOpen(false);
        } catch (err: any) {
            toast.error(t('pinFailed'), { description: err.message });
        } finally {
            setBusy(false);
        }
    };

    const handleMute = async () => {
        setBusy(true);
        try {
            await apiClient.post('/chat/participants/mute', {
                conversationId,
                participantUserId: senderId,
                durationMinutes: 60,
            }, { skipGlobalToast: true });
            toast.success(t('muted'));
            setOpen(false);
        } catch (err: any) {
            toast.error(t('muteFailed'), { description: err.message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="absolute right-1.5 top-1.5 z-20">
            {open && (
                <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setOpen(false)}
                />
            )}

            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('pin')}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
                <MoreHorizontal className="size-4" />
            </Button>

            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-input border border-border bg-card shadow-dropdown">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handlePin}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-55"
                    >
                        {isPinned ? (
                            <PinOff className="size-4 shrink-0" />
                        ) : (
                            <Pin className="size-4 shrink-0" />
                        )}
                        {isPinned ? t('unpin') : t('pin')}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={handleMute}
                        className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive-subtle disabled:opacity-55"
                    >
                        <VolumeX className="size-4 shrink-0" />
                        {t('muteUser')}
                    </button>
                </div>
            )}
        </div>
    );
}
