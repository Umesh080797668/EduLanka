import * as React from 'react';
import { cn } from '@/lib/cn';

export function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            aria-hidden
            className={cn('animate-shimmer rounded-md bg-muted', className)}
            {...props}
        />
    );
}

/** Skeleton for a page whose main content is a table. */
export function PageSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full space-y-6" role="status" aria-label="Loading">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-10 w-32 rounded-input" />
            </div>

            <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <div className="flex gap-4 border-b border-border bg-muted/60 px-4 py-3.5">
                    {Array.from({ length: cols }).map((_, i) => (
                        <Skeleton key={i} className="h-3 flex-1" />
                    ))}
                </div>
                <div className="divide-y divide-border">
                    {Array.from({ length: rows }).map((_, r) => (
                        <div key={r} className="flex items-center gap-4 px-4 py-4">
                            {Array.from({ length: cols }).map((_, c) => (
                                <Skeleton
                                    key={c}
                                    className={cn('h-4 flex-1', c === 0 && 'max-w-[35%]')}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Skeleton for a stat-card grid followed by a panel. */
export function DashboardCardsSkeleton({ cards = 4 }: { cards?: number }) {
    return (
        <div className="w-full space-y-6" role="status" aria-label="Loading">
            <div className="space-y-2">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: cards }).map((_, i) => (
                    <div
                        key={i}
                        className="space-y-3 rounded-card border border-border bg-card p-5 shadow-card"
                    >
                        <div className="flex items-start justify-between">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="size-9 rounded-[10px]" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-64 rounded-card lg:col-span-2" />
                <Skeleton className="h-64 rounded-card" />
            </div>
        </div>
    );
}

/** Skeleton rows for use inside an existing table body. */
export function TableRowsSkeleton({
    rows = 5,
    cols = 4,
}: {
    rows?: number;
    cols?: number;
}) {
    return (
        <>
            {Array.from({ length: rows }).map((_, r) => (
                <tr key={r}>
                    {Array.from({ length: cols }).map((_, c) => (
                        <td key={c} className="px-4 py-3.5">
                            <Skeleton className={cn('h-4', c === 0 ? 'w-40' : 'w-24')} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
