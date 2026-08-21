import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Deterministic avatar tint derived from the name, so the same person keeps the
 * same colour across the product without storing anything.
 */
const TINTS = [
    'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200',
    'bg-success-subtle text-success-subtle-foreground',
    'bg-warning-subtle text-warning-subtle-foreground',
    'bg-info-subtle text-info-subtle-foreground',
    'bg-destructive-subtle text-destructive-subtle-foreground',
] as const;

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function initialsOf(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const SIZE = {
    xs: 'size-6 text-[10px]',
    sm: 'size-8 text-[11px]',
    md: 'size-10 text-xs',
    lg: 'size-12 text-sm',
    xl: 'size-16 text-lg',
} as const;

export interface AvatarProps {
    name?: string | null;
    src?: string | null;
    size?: keyof typeof SIZE;
    /** Square with rounded corners instead of a circle. */
    square?: boolean;
    /** Ring colour indicating presence. */
    status?: 'online' | 'offline' | null;
    className?: string;
}

export function Avatar({
    name,
    src,
    size = 'md',
    square = false,
    status = null,
    className,
}: AvatarProps) {
    const tint = TINTS[hashString(name ?? '') % TINTS.length]!;

    return (
        <span className={cn('relative inline-flex shrink-0', className)}>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary tenant storage hosts
                <img
                    src={src}
                    alt={name ?? ''}
                    className={cn(
                        'object-cover',
                        SIZE[size],
                        square ? 'rounded-[10px]' : 'rounded-full',
                    )}
                />
            ) : (
                <span
                    aria-hidden
                    className={cn(
                        'grid place-items-center font-bold uppercase tracking-wide',
                        SIZE[size],
                        square ? 'rounded-[10px]' : 'rounded-full',
                        tint,
                    )}
                >
                    {initialsOf(name)}
                </span>
            )}

            {status && (
                <span
                    className={cn(
                        'absolute bottom-0 right-0 block size-2.5 rounded-full border-2 border-card',
                        status === 'online' ? 'bg-success' : 'bg-muted-foreground',
                    )}
                    aria-hidden
                />
            )}
        </span>
    );
}

/** Overlapping avatar row, e.g. class participants. */
export function AvatarStack({
    names,
    max = 4,
    size = 'sm',
    className,
}: {
    names: string[];
    max?: number;
    size?: keyof typeof SIZE;
    className?: string;
}) {
    const shown = names.slice(0, max);
    const overflow = names.length - shown.length;

    return (
        <span className={cn('flex items-center', className)}>
            {shown.map((name, i) => (
                <Avatar
                    key={`${name}-${i}`}
                    name={name}
                    size={size}
                    className="-ml-2 ring-2 ring-card first:ml-0 [&>*]:rounded-full"
                />
            ))}
            {overflow > 0 && (
                <span
                    className={cn(
                        'numeric -ml-2 grid place-items-center rounded-full bg-muted font-bold text-muted-foreground ring-2 ring-card',
                        SIZE[size],
                    )}
                >
                    +{overflow}
                </span>
            )}
        </span>
    );
}
