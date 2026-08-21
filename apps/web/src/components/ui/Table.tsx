import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Table primitives.
 *
 * `TableWrap` provides the rounded border + horizontal scroll container, so
 * tables degrade gracefully on narrow viewports instead of blowing out the
 * page width.
 */

export function TableWrap({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'w-full overflow-x-auto rounded-card border border-border bg-card shadow-card',
                className,
            )}
            {...props}
        />
    );
}

export function Table({
    className,
    ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
    return (
        <table
            className={cn('w-full caption-bottom border-collapse text-sm', className)}
            {...props}
        />
    );
}

export function THead({
    className,
    ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <thead
            className={cn('bg-muted/60 [&_tr]:border-b [&_tr]:border-border', className)}
            {...props}
        />
    );
}

export function TBody({
    className,
    ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <tbody
            className={cn(
                'divide-y divide-border [&_tr:last-child]:border-0',
                className,
            )}
            {...props}
        />
    );
}

export function TFoot({
    className,
    ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <tfoot
            className={cn(
                'border-t border-border bg-muted/60 font-semibold',
                className,
            )}
            {...props}
        />
    );
}

export interface TRProps extends React.HTMLAttributes<HTMLTableRowElement> {
    /** Adds a hover surface — use when the row is clickable. */
    interactive?: boolean;
    selected?: boolean;
}

export function TR({ className, interactive, selected, ...props }: TRProps) {
    return (
        <tr
            data-selected={selected || undefined}
            className={cn(
                'transition-colors',
                interactive && 'cursor-pointer hover:bg-accent/60',
                selected && 'bg-primary-subtle',
                className,
            )}
            {...props}
        />
    );
}

export interface THProps
    extends React.ThHTMLAttributes<HTMLTableCellElement> {
    align?: 'left' | 'center' | 'right';
}

export function TH({ className, align = 'left', ...props }: THProps) {
    return (
        <th
            scope="col"
            className={cn(
                'whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                align === 'left' && 'text-left',
                className,
            )}
            {...props}
        />
    );
}

export interface TDProps
    extends React.TdHTMLAttributes<HTMLTableCellElement> {
    align?: 'left' | 'center' | 'right';
    /** Tabular numerals — for marks, counts, money. */
    numeric?: boolean;
}

export function TD({
    className,
    align = 'left',
    numeric = false,
    ...props
}: TDProps) {
    return (
        <td
            className={cn(
                'px-4 py-3 align-middle text-sm text-foreground',
                align === 'center' && 'text-center',
                align === 'right' && 'text-right',
                numeric && 'numeric',
                className,
            )}
            {...props}
        />
    );
}

/** Full-width cell for empty / loading states inside a table body. */
export function TDEmpty({
    colSpan,
    className,
    children,
}: {
    colSpan: number;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <tr>
            <td colSpan={colSpan} className={cn('p-0', className)}>
                {children}
            </td>
        </tr>
    );
}
