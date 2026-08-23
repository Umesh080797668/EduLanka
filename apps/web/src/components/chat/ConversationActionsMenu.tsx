'use client';

import * as React from 'react';
import { BellOff, BellRing, ChevronRight, LogOut, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/cn';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

// ── Mute duration options ─────────────────────────────────────────────────────
const MUTE_OPTIONS = [
    { key: 'mute1h', minutes: 60 },
    { key: 'mute4h', minutes: 240 },
    { key: 'mute1w', minutes: 10_080 },
    { key: 'mute1m', minutes: 43_200 },
    // "Until I turn them back on" — 50 years expressed in minutes
    { key: 'muteIndefinite', minutes: 26_280_000 },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
    conversationId: string;
    conversationType: string;   // 'DIRECT' | 'GROUP' | 'CLASS'
    isMuted?: boolean;
    /** Called when the caller's membership is removed (Delete / Leave). */
    onRemoved: (id: string) => void;
    /** Called after a successful mute/unmute so the list can update the icon. */
    onMuted?: (id: string, muted: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
/**
 * Three-dot (⋯) dropdown with WhatsApp-style conversation actions.
 *
 * Semantics:
 *  - Mute notifications  → submenu with duration options (applies to caller only).
 *  - Delete chat         → removes only the caller's participant row.
 *                          Other participants are unaffected.
 *  - Leave group         → GROUP threads only; same as Delete chat in effect.
 *
 * "Delete for Me / Delete for Everyone" applies only to individual messages,
 * not to conversations.
 */
export default function ConversationActionsMenu({
    conversationId,
    conversationType,
    isMuted = false,
    onRemoved,
    onMuted,
}: Props) {
    const t = useTranslations('Chat');
    const [open, setOpen] = React.useState(false);
    const [muteOpen, setMuteOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    // Which destructive action is waiting for the confirmation click.
    const [confirming, setConfirming] = React.useState<'delete' | 'leave' | null>(null);

    const isGroup = conversationType === 'GROUP' || conversationType === 'CLASS';

    const close = () => { setOpen(false); setMuteOpen(false); setConfirming(null); };

    // ── Mute ──────────────────────────────────────────────────────────────────
    const handleMute = async (minutes: number) => {
        setBusy(true);
        try {
            await apiClient.post(
                `/chat/conversations/${conversationId}/mute`,
                { durationMinutes: minutes },
                { skipGlobalToast: true },
            );
            toast.success(t('muteSuccess'));
            onMuted?.(conversationId, true);
            close();
        } catch (err: any) {
            toast.error(t('muteFailed'), { description: err?.message });
        } finally {
            setBusy(false);
        }
    };

    const handleUnmute = async () => {
        setBusy(true);
        try {
            // Setting muted_until to 'now' effectively unmutes.
            await apiClient.post(
                `/chat/conversations/${conversationId}/mute`,
                { durationMinutes: 0 },
                { skipGlobalToast: true },
            );
            toast.success(t('unmuteSuccess'));
            onMuted?.(conversationId, false);
            close();
        } catch (err: any) {
            toast.error(t('muteFailed'), { description: err?.message });
        } finally {
            setBusy(false);
        }
    };

    // ── Delete (scope=me — removes only caller's participant row) ─────────────
    const handleDelete = async () => {
        if (confirming !== 'delete') { setConfirming('delete'); setMuteOpen(false); return; }
        setBusy(true);
        try {
            await apiClient.delete(
                `/chat/conversations/${conversationId}?scope=me`,
                { skipGlobalToast: true },
            );
            toast.success(t('deleteSuccess'));
            onRemoved(conversationId);
            close();
        } catch (err: any) {
            toast.error(t('deleteFailed'), { description: err?.message });
        } finally {
            setBusy(false);
            setConfirming(null);
        }
    };

    // ── Leave group ───────────────────────────────────────────────────────────
    const handleLeave = async () => {
        if (confirming !== 'leave') { setConfirming('leave'); setMuteOpen(false); return; }
        setBusy(true);
        try {
            await apiClient.post(
                `/chat/conversations/${conversationId}/leave`,
                {},
                { skipGlobalToast: true },
            );
            toast.success(t('leaveSuccess'));
            onRemoved(conversationId);
            close();
        } catch (err: any) {
            toast.error(t('leaveFailed'), { description: err?.message });
        } finally {
            setBusy(false);
            setConfirming(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div
            className="relative shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && close()}
        >
            {/* Click-outside overlay */}
            {open && (
                <div className="fixed inset-0 z-10" aria-hidden onClick={close} />
            )}

            {/* Trigger */}
            <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('conversationActions')}
                aria-expanded={open}
                onClick={() => { setOpen((v) => !v); setMuteOpen(false); setConfirming(null); }}
                className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
                <MoreHorizontal className="size-4" />
            </Button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-input border border-border bg-card shadow-dropdown">

                    {/* ── Confirmation banner ────────────────────────────────── */}
                    {confirming && (
                        <div className="border-b border-border bg-muted/50 px-3 py-2.5">
                            <p className="text-xs font-semibold text-foreground">
                                {confirming === 'delete' ? t('confirmDeleteChat') : t('confirmLeave')}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                                {confirming === 'delete' ? t('confirmDeleteChatDesc') : t('confirmLeaveDesc')}
                            </p>
                            <button
                                type="button"
                                onClick={() => setConfirming(null)}
                                className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
                            >
                                {t('cancelConfirm')}
                            </button>
                        </div>
                    )}

                    {/* ── Mute ──────────────────────────────────────────────── */}
                    {!isMuted ? (
                        <div className="relative">
                            <MenuItem
                                icon={<BellOff className="size-4 shrink-0" />}
                                label={t('mute')}
                                trailingIcon={<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                                onClick={() => setMuteOpen((v) => !v)}
                                disabled={busy}
                            />

                            {/* Mute duration sub-menu */}
                            {muteOpen && (
                                <div className="absolute left-full top-0 z-30 ml-0.5 w-52 overflow-hidden rounded-input border border-border bg-card shadow-dropdown">
                                    {MUTE_OPTIONS.map(({ key, minutes }) => (
                                        <MenuItem
                                            key={key}
                                            label={t(key as any)}
                                            onClick={() => handleMute(minutes)}
                                            disabled={busy}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <MenuItem
                            icon={<BellRing className="size-4 shrink-0" />}
                            label={t('unmute')}
                            onClick={handleUnmute}
                            disabled={busy}
                        />
                    )}

                    <div className="my-0.5 border-t border-border" />

                    {/* ── Delete chat ───────────────────────────────────────── */}
                    <MenuItem
                        icon={<Trash2 className="size-4 shrink-0" />}
                        label={
                            confirming === 'delete'
                                ? `${t('deleteChat')} — ${t('confirmDeleteChat')}`
                                : t('deleteChat')
                        }
                        onClick={handleDelete}
                        disabled={busy}
                        danger
                    />

                    {/* ── Leave group (GROUP / CLASS only) ──────────────────── */}
                    {isGroup && (
                        <MenuItem
                            icon={<LogOut className="size-4 shrink-0" />}
                            label={
                                confirming === 'leave'
                                    ? `${t('leaveConversation')} — ${t('confirmLeave')}`
                                    : t('leaveConversation')
                            }
                            onClick={handleLeave}
                            disabled={busy}
                            danger
                        />
                    )}
                </div>
            )}
        </div>
    );
}

// ── Internal helper ───────────────────────────────────────────────────────────
function MenuItem({
    icon,
    label,
    trailingIcon,
    onClick,
    disabled,
    danger,
}: {
    icon?: React.ReactNode;
    label: string;
    trailingIcon?: React.ReactNode;
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
            <span className="flex-1">{label}</span>
            {trailingIcon}
        </button>
    );
}
