import * as React from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    /** `raised` lifts on hover — use for cards that are links. */
    interactive?: boolean;
    /** Removes the border/shadow, keeping only the surface colour. */
    flush?: boolean;
}

export function Card({
    className,
    interactive = false,
    flush = false,
    ...props
}: CardProps) {
    return (
        <div
            className={cn(
                'rounded-card bg-card text-card-foreground',
                !flush && 'border border-border shadow-card',
                interactive &&
                'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-hover',
                className,
            )}
            {...props}
        />
    );
}

export function CardHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6',
                className,
            )}
            {...props}
        />
    );
}

export function CardTitle({
    className,
    as: Comp = 'h3',
    ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
    as?: 'h1' | 'h2' | 'h3' | 'h4';
}) {
    return (
        <Comp
            className={cn('text-base font-semibold tracking-tight', className)}
            {...props}
        />
    );
}

export function CardDescription({
    className,
    ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
    return (
        <p
            className={cn('mt-1 text-sm leading-relaxed text-muted-foreground', className)}
            {...props}
        />
    );
}

export function CardContent({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props} />;
}

export function CardFooter({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-3 border-t border-border px-5 py-4 sm:px-6',
                className,
            )}
            {...props}
        />
    );
}

/** Thin horizontal rule that matches the card border. */
export function CardSeparator({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            role="separator"
            className={cn('h-px w-full bg-border', className)}
            {...props}
        />
    );
}
