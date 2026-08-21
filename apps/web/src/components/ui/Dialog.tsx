'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Icon shown next to the title, tinted by `tone`. */
    icon?: React.ReactNode;
    tone?: 'neutral' | 'primary' | 'danger' | 'warning';
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Footer content — usually a cancel + confirm pair. */
    footer?: React.ReactNode;
    /** Set false to force an explicit action (no backdrop/Esc dismissal). */
    dismissible?: boolean;
    children?: React.ReactNode;
    className?: string;
}

const SIZE: Record<NonNullable<DialogProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

const ICON_TONE: Record<NonNullable<DialogProps['tone']>, string> = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-subtle text-primary-subtle-foreground',
    danger: 'bg-destructive-subtle text-destructive-subtle-foreground',
    warning: 'bg-warning-subtle text-warning-subtle-foreground',
};

export function Dialog({
    open,
    onClose,
    title,
    description,
    icon,
    tone = 'neutral',
    size = 'md',
    footer,
    dismissible = true,
    children,
    className,
}: DialogProps) {
    const [mounted, setMounted] = React.useState(false);
    const panelRef = React.useRef<HTMLDivElement>(null);
    const titleId = React.useId();
    const descId = React.useId();

    React.useEffect(() => setMounted(true), []);

    // Escape to close + scroll lock while open.
    React.useEffect(() => {
        if (!open) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && dismissible) onClose();
        };

        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, dismissible, onClose]);

    // Move focus into the panel so keyboard users land in the dialog.
    React.useEffect(() => {
        if (!open) return;
        const raf = requestAnimationFrame(() => {
            const target = panelRef.current?.querySelector<HTMLElement>(
                '[data-autofocus], input:not([type="hidden"]), textarea, select, button',
            );
            (target ?? panelRef.current)?.focus();
        });
        return () => cancelAnimationFrame(raf);
    }, [open]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        onClick={dismissible ? onClose : undefined}
                        className="absolute inset-0 bg-neutral-950/45 backdrop-blur-sm dark:bg-neutral-950/70"
                    />

                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={title ? titleId : undefined}
                        aria-describedby={description ? descId : undefined}
                        tabIndex={-1}
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                            'relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-popover text-popover-foreground shadow-modal outline-none',
                            'rounded-t-card sm:rounded-card',
                            SIZE[size],
                            className,
                        )}
                    >
                        {(title || dismissible) && (
                            <div className="flex items-start gap-3.5 border-b border-border px-5 py-4 sm:px-6">
                                {icon && (
                                    <span
                                        className={cn(
                                            'grid size-10 shrink-0 place-items-center rounded-[10px] [&_svg]:size-5',
                                            ICON_TONE[tone],
                                        )}
                                        aria-hidden
                                    >
                                        {icon}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    {title && (
                                        <h2
                                            id={titleId}
                                            className="text-base font-semibold tracking-tight"
                                        >
                                            {title}
                                        </h2>
                                    )}
                                    {description && (
                                        <p
                                            id={descId}
                                            className="mt-1 text-sm leading-relaxed text-muted-foreground"
                                        >
                                            {description}
                                        </p>
                                    )}
                                </div>
                                {dismissible && (
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        aria-label="Close"
                                        className="-mr-1.5 -mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        )}

                        {children && (
                            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                                {children}
                            </div>
                        )}

                        {footer && (
                            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-muted/40 px-5 py-4 sm:px-6">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

/**
 * Confirmation dialog — replaces `window.confirm()` for destructive actions.
 */
export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    cancelLabel,
    tone = 'danger',
    icon,
    loading = false,
    children,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel: React.ReactNode;
    cancelLabel: React.ReactNode;
    tone?: 'danger' | 'warning' | 'primary';
    icon?: React.ReactNode;
    loading?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            description={description}
            icon={icon}
            tone={tone}
            size="sm"
            dismissible={!loading}
            footer={
                <>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={tone === 'primary' ? 'primary' : 'destructive'}
                        onClick={onConfirm}
                        loading={loading}
                        data-autofocus
                    >
                        {confirmLabel}
                    </Button>
                </>
            }
        >
            {children}
        </Dialog>
    );
}
