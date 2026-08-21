import * as React from 'react';
import { cn } from '@/lib/cn';

/* ── PageHeader ──────────────────────────────────────────────────────────── */

export interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Breadcrumb / back-link row rendered above the title. */
    breadcrumb?: React.ReactNode;
    /** Buttons, filters — right-aligned on wide viewports. */
    actions?: React.ReactNode;
    /** Badge or chip rendered inline after the title. */
    badge?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    breadcrumb,
    actions,
    badge,
    icon,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn('mb-6', className)}>
            {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3.5">
                    {icon && (
                        <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-card bg-primary-subtle text-primary-subtle-foreground [&_svg]:size-5">
                            {icon}
                        </span>
                    )}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-display-sm text-foreground">{title}</h1>
                            {badge}
                        </div>
                        {description && (
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── SectionHeading ──────────────────────────────────────────────────────── */

export function SectionHeading({
    title,
    description,
    actions,
    className,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'mb-4 flex flex-wrap items-end justify-between gap-3',
                className,
            )}
        >
            <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                    {title}
                </h2>
                {description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
    );
}

/* ── EmptyState ──────────────────────────────────────────────────────────── */

export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    /** `sm` for inside cards/tables, `md` for full page regions. */
    size?: 'sm' | 'md';
    /** Signals a failure rather than "nothing here yet". */
    tone?: 'neutral' | 'danger';
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
    size = 'md',
    tone = 'neutral',
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center text-center',
                size === 'sm' ? 'px-6 py-10' : 'px-6 py-16',
                className,
            )}
        >
            {icon && (
                <div
                    className={cn(
                        'mb-4 grid place-items-center rounded-card',
                        size === 'sm' ? 'size-11 [&_svg]:size-5' : 'size-14 [&_svg]:size-6',
                        tone === 'danger'
                            ? 'bg-destructive-subtle text-destructive-subtle-foreground'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    {icon}
                </div>
            )}
            <h3
                className={cn(
                    'font-semibold tracking-tight text-foreground',
                    size === 'sm' ? 'text-sm' : 'text-base',
                )}
            >
                {title}
            </h3>
            {description && (
                <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {description}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
