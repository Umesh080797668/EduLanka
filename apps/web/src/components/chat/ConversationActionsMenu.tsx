'use client';

import * as React from 'react';
import { LogOut, MoreHorizontal, Trash2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

interface ConversationActionsMenuProps {
    conversationId: string;
    conversationType: string;
    /** Callback after the caller's membership is removed (Delete for Me / Leave). */
    onRemoved: (id: string) => void;
    /** Callback after a successful mute — parent can update is_muted badge. */
    onMuted?: (id: string) => void;
}

/**
 * Three-dot (⋯) dropdown with WhatsApp-style conversation actions.
 *
 * - Mute (1 h)             — available on all conversation types.
 * - Delete for Me          — removes only the caller's participant row.
 * - Delete for Everyone    — hard-deletes the thread (DIRECT: either party; GROUP: creator only, enforced server-side).
 * - Leave group            — GROUP only; removes the caller from the group.
 */
export default function ConversationActionsMenu({
    conversationId,
    conversationType,
    onRemoved,
    onMuted,
}: ConversationActionsMenuProps) {
    const t = useTranslations('Chat');
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    /** Tracks which destructive action is pending a confirmation click. */
    const [confirming, setConfirming] = React.useState<'me' | 'everyone' | 'leave' | null>(null);

    const isGroup = conversationType === 'GROUP' || conversationType === 'CLASS';

    const handleMute = async () => {
        setBusy(true);
        try {
            await apiClient.post(
                `/chat/conversations/${conversationId}/mute`,
                { durationMinutes: 60 },
                { skipGlobalToast: true },
            );
            toast.success(t('muteSuccess'));
            onMuted?.(conversationId);
            setOpen(false);
        } catch (err: any) {
            toast.error(t('muteFailed'), { description: err?.message });
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteForMe = async () => {
        if (confirming !== 'me') { setConfirming('me'); return; }
        setBusy(true);
        try {
            await apiClient.delete(
                `/chat/conversations/${conversationId}?scope=me`,
                { skipGlobalToast: true },
            );
            toast.success(t('deleteForMeSuccess'));
            onRemoved(conversationId);
            setOpen(false);
        } catch (err: any) {
            toast.error(t('deleteFailed'), { description: err?.message });
        } finally {
            setBusy(false);
            setConfirming(null);
        }
    };

    const handleDeleteForEveryone = async () => {
        if (confirming !== 'everyone') { setConfirming('everyone'); return; }
        setBusy(true);
        try {
            await apiClient.delete(
                `/chat/conversations/${conversationId}?scope=everyone`,
                { skipGlobalToast: true },
            );
            toast.success(t('deleteForEveryoneSuccess'));
            onRemoved(conversationId);
            setOpen(false);
        } catch (err: any) {
            toast.error(t('deleteFailed'), { description: err?.message });
        } finally {
            setBusy(false);
            setConfirming(null);
        }
    };

    const handleLeave = async () => {
        if (confirming !== 'leave') { setConfirming('leave'); return; }
        setBusy(true);
        try {
            await apiClient.post(
                `/chat/conversations/${conversationId}/leave`,
                {},
                { skipGlobalToast: true },
            );
            toast.success(t('leaveSuccess'));
            onRemoved(conversationId);
            setOpen(false);
        } catch (err: any) {
            toast.error(t('leaveFailed'), { description: err?.message });
        } finally {
            setBusy(false);
            setConfirming(null);
        }
    };

    const cancelConfirm = () => setConfirming(null);

    return (
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Overlay to close on outside click */}
            {open && (
                <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => { setOpen(false); setConfirming(null); }}
                />
            )}

            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('conversationActions')}
                aria-expanded={open}
                onClick={() => { setOpen((v) => !v); setConfirming(null); }}
                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
                <MoreHorizontal className="size-4" />
            </Button>

            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-input border border-border bg-card shadow-dropdown">
                    {/* ── Confirmation banner ────────────────────────────────── */}
                    {confirming && (
                        <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs">
                            <p className="font-semibold text-foreground">{t('confirmDelete')}</p>
                            <p className="mt-0.5 text-muted-foreground">
                                {confirming === 'me' && t('confirmDeleteMeDesc')}
                                {confirming === 'everyone' && t('confirmDeleteEveryoneDesc')}
                                {confirming === 'leave' && t('confirmDeleteEveryoneDesc')}
                            </p>
                            <button
                                type="button"
                                onClick={cancelConfirm}
                                className="mt-1.5 text-xs font-medium text-primary hover:underline"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* ── Mute ──────────────────────────────────────────────── */}
                    <MenuItem
                        icon={<VolumeX className="size-4 shrink-0" />}
                        label={t('muteConversation')}
                        onClick={handleMute}
                        disabled={busy}
                    />

                    <div className="my-0.5 border-t border-border" />

                    {/* ── Delete for Me ─────────────────────────────────────── */}
                    <MenuItem
                        icon={<Trash2 className="size-4 shrink-0" />}
                        label={confirming === 'me' ? '⚠ ' + t('deleteForMe') + ' — confirm' : t('deleteForMe')}
                        onClick={handleDeleteForMe}
                        disabled={busy}
                        danger
                    />

                    {/* ── Delete for Everyone ───────────────────────────────── */}
                    <MenuItem
                        icon={<Trash2 className="size-4 shrink-0" />}
                        label={confirming === 'everyone' ? '⚠ ' + t('deleteForEveryone') + ' — confirm' : t('deleteForEveryone')}
                        onClick={handleDeleteForEveryone}
                        disabled={busy}
                        danger
                    />

                    {/* ── Leave (GROUP only) ────────────────────────────────── */}
                    {isGroup && (
                        <>
                            <div className="my-0.5 border-t border-border" />
                            <MenuItem
                                icon={<LogOut className="size-4 shrink-0" />}
                                label={confirming === 'leave' ? '⚠ ' + t('leaveConversation') + ' — confirm' : t('leaveConversation')}
                                onClick={handleLeave}
                                disabled={busy}
                                danger
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function MenuItem({
    icon,
    label,
    onClick,
    disabled,
    danger,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-55',
                danger
                    ? 'text-destructive hover:bg-destructive-subtle'
                    : 'text-foreground hover:bg-muted',
            )}
        >
            {icon}
            {label}
        </button>
    );
}
