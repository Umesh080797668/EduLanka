import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StatTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const ICON_TONE: Record<StatTone, string> = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-subtle text-primary-subtle-foreground',
    success: 'bg-success-subtle text-success-subtle-foreground',
    warning: 'bg-warning-subtle text-warning-subtle-foreground',
    danger: 'bg-destructive-subtle text-destructive-subtle-foreground',
    info: 'bg-info-subtle text-info-subtle-foreground',
};

export interface StatCardProps {
    label: React.ReactNode;
    value: React.ReactNode;
    /** Small caption under the value. */
    hint?: React.ReactNode;
    icon?: React.ReactNode;
    tone?: StatTone;
    /** Percentage/absolute delta vs. previous period. */
    delta?: { value: string; direction: 'up' | 'down' | 'flat'; /** `true` when "up" is bad (e.g. absences). */ inverted?: boolean };
    /** Renders a shimmer instead of the value. */
    loading?: boolean;
    className?: string;
}

export function StatCard({
    label,
    value,
    hint,
    icon,
    tone = 'primary',
    delta,
    loading = false,
    className,
}: StatCardProps) {
    const DeltaIcon =
        delta?.direction === 'up'
            ? ArrowUpRight
            : delta?.direction === 'down'
                ? ArrowDownRight
                : Minus;

    // "Good" is green; invert for metrics where a rise is bad.
    const deltaGood =
        delta?.direction === 'flat'
            ? null
            : delta?.inverted
                ? delta?.direction === 'down'
                : delta?.direction === 'up';

    return (
        <div
            className={cn(
                'rounded-card border border-border bg-card p-5 shadow-card',
                'transition-[box-shadow,border-color] duration-200 hover:border-border-strong hover:shadow-card-hover',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                </p>
                {icon && (
                    <span
                        className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-[10px] [&_svg]:size-[18px]',
                            ICON_TONE[tone],
                        )}
                    >
                        {icon}
                    </span>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                {loading ? (
                    <span className="block h-8 w-20 animate-shimmer rounded-md bg-muted" />
                ) : (
                    <span className="numeric text-3xl font-bold leading-none tracking-tight text-foreground">
                        {value}
                    </span>
                )}

                {delta && !loading && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[11px] font-bold',
                            deltaGood === null
                                ? 'bg-muted text-muted-foreground'
                                : deltaGood
                                    ? 'bg-success-subtle text-success-subtle-foreground'
                                    : 'bg-destructive-subtle text-destructive-subtle-foreground',
                        )}
                    >
                        <DeltaIcon className="size-3" aria-hidden />
                        {delta.value}
                    </span>
                )}
            </div>

            {hint && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}

/* ── Progress ────────────────────────────────────────────────────────────── */

const BAR_TONE: Record<StatTone, string> = {
    neutral: 'bg-muted-foreground',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info',
};

export interface ProgressProps {
    /** 0–100. Values outside the range are clamped. */
    value: number;
    tone?: StatTone;
    size?: 'sm' | 'md';
    label?: React.ReactNode;
    /** Right-aligned caption on the label row. */
    valueLabel?: React.ReactNode;
    className?: string;
}

export function Progress({
    value,
    tone = 'primary',
    size = 'md',
    label,
    valueLabel,
    className,
}: ProgressProps) {
    const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

    return (
        <div className={cn('w-full', className)}>
            {(label || valueLabel) && (
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    {label && <span className="font-medium text-foreground">{label}</span>}
                    {valueLabel && (
                        <span className="numeric font-semibold text-muted-foreground">
                            {valueLabel}
                        </span>
                    )}
                </div>
            )}
            <div
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                className={cn(
                    'w-full overflow-hidden rounded-pill bg-muted',
                    size === 'sm' ? 'h-1.5' : 'h-2.5',
                )}
            >
                <div
                    className={cn(
                        'h-full rounded-pill transition-[width] duration-500 ease-out',
                        BAR_TONE[tone],
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
