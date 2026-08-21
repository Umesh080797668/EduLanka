import * as React from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Info,
    OctagonAlert,
    X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<AlertTone, { wrap: string; icon: string }> = {
    info: {
        wrap: 'border-info/25 bg-info-subtle text-info-subtle-foreground',
        icon: 'text-info',
    },
    success: {
        wrap: 'border-success/25 bg-success-subtle text-success-subtle-foreground',
        icon: 'text-success',
    },
    warning: {
        wrap: 'border-warning/30 bg-warning-subtle text-warning-subtle-foreground',
        icon: 'text-warning',
    },
    danger: {
        wrap: 'border-destructive/25 bg-destructive-subtle text-destructive-subtle-foreground',
        icon: 'text-destructive',
    },
    neutral: {
        wrap: 'border-border bg-muted text-foreground',
        icon: 'text-muted-foreground',
    },
};

const DEFAULT_ICON: Record<AlertTone, React.ElementType> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: OctagonAlert,
    neutral: Info,
};

export interface AlertProps
    extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    tone?: AlertTone;
    title?: React.ReactNode;
    /** Pass `null` to hide the icon entirely. */
    icon?: React.ReactNode | null;
    onDismiss?: () => void;
    /** Buttons rendered under the body. */
    actions?: React.ReactNode;
}

export function Alert({
    className,
    tone = 'info',
    title,
    icon,
    onDismiss,
    actions,
    children,
    ...props
}: AlertProps) {
    const Fallback = DEFAULT_ICON[tone];
    const showIcon = icon !== null;

    return (
        <div
            role={tone === 'danger' ? 'alert' : 'status'}
            className={cn(
                'flex items-start gap-3 rounded-card border p-4',
                TONE[tone].wrap,
                className,
            )}
            {...props}
        >
            {showIcon && (
                <span
                    className={cn('mt-px shrink-0 [&_svg]:size-[18px]', TONE[tone].icon)}
                    aria-hidden
                >
                    {icon ?? <Fallback />}
                </span>
            )}

            <div className="min-w-0 flex-1">
                {title && (
                    <p className="text-sm font-semibold tracking-tight">{title}</p>
                )}
                {children && (
                    <div
                        className={cn(
                            'text-sm leading-relaxed opacity-90',
                            title && 'mt-0.5',
                        )}
                    >
                        {children}
                    </div>
                )}
                {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
            </div>

            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="-mr-1 -mt-1 shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}

/**
 * Inline callout used inside cards — lighter than `Alert`, no border.
 */
export function Note({
    className,
    tone = 'neutral',
    children,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone?: AlertTone }) {
    return (
        <p
            className={cn(
                'rounded-input px-3 py-2 text-xs leading-relaxed',
                TONE[tone].wrap,
                className,
            )}
            {...props}
        >
            {children}
        </p>
    );
}
