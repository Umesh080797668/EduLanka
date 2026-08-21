import * as React from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone =
    | 'neutral'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';

export type BadgeVariant = 'soft' | 'solid' | 'outline';

const SOFT: Record<BadgeTone, string> = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-subtle text-primary-subtle-foreground',
    success: 'bg-success-subtle text-success-subtle-foreground',
    warning: 'bg-warning-subtle text-warning-subtle-foreground',
    danger: 'bg-destructive-subtle text-destructive-subtle-foreground',
    info: 'bg-info-subtle text-info-subtle-foreground',
};

const SOLID: Record<BadgeTone, string> = {
    neutral: 'bg-foreground text-background',
    primary: 'bg-primary text-primary-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
    danger: 'bg-destructive text-destructive-foreground',
    info: 'bg-info text-info-foreground',
};

const OUTLINE: Record<BadgeTone, string> = {
    neutral: 'border border-border text-muted-foreground',
    primary: 'border border-primary/35 text-primary',
    success: 'border border-success/35 text-success',
    warning: 'border border-warning/40 text-warning',
    danger: 'border border-destructive/35 text-destructive',
    info: 'border border-info/35 text-info',
};

const DOT: Record<BadgeTone, string> = {
    neutral: 'bg-muted-foreground',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    /** Renders a leading status dot. */
    dot?: boolean;
    /** Pulses the dot — for live/active states. */
    pulse?: boolean;
}

export function Badge({
    className,
    tone = 'neutral',
    variant = 'soft',
    size = 'sm',
    dot = false,
    pulse = false,
    children,
    ...props
}: BadgeProps) {
    const palette =
        variant === 'solid' ? SOLID : variant === 'outline' ? OUTLINE : SOFT;

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-pill font-semibold',
                size === 'sm'
                    ? 'px-2 py-0.5 text-[11px]'
                    : 'px-2.5 py-1 text-xs',
                palette[tone],
                className,
            )}
            {...props}
        >
            {dot && (
                <span className="relative flex size-1.5 shrink-0">
                    {pulse && (
                        <span
                            className={cn(
                                'absolute inline-flex size-full animate-ping rounded-full opacity-70',
                                DOT[tone],
                            )}
                        />
                    )}
                    <span
                        className={cn(
                            'relative inline-flex size-1.5 rounded-full',
                            variant === 'solid' ? 'bg-current' : DOT[tone],
                        )}
                    />
                </span>
            )}
            {children}
        </span>
    );
}

/**
 * Uppercase micro-label used above stat values and in table group headers.
 */
export function Eyebrow({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn(
                'text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
                className,
            )}
            {...props}
        />
    );
}
