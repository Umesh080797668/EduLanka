import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SpinnerProps {
    /** Caption under the spinner. Pass `null` for a bare spinner. */
    text?: string | null;
    /** Centres the spinner in a tall region. */
    fullScreen?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const SIZE = {
    sm: 'size-4',
    md: 'size-6',
    lg: 'size-9',
} as const;

export function Spinner({
    text = null,
    fullScreen = false,
    size = 'lg',
    className,
}: SpinnerProps) {
    const content = (
        <div
            role="status"
            aria-live="polite"
            className={cn('flex flex-col items-center justify-center gap-3 p-8', className)}
        >
            <Loader2
                className={cn('animate-spin text-primary', SIZE[size])}
                strokeWidth={2.25}
                aria-hidden
            />
            {text !== null && (
                <p className="text-sm font-medium text-muted-foreground">{text}</p>
            )}
            <span className="sr-only">Loading</span>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="flex min-h-[50vh] w-full items-center justify-center">
                {content}
            </div>
        );
    }

    return content;
}

/** Fills the viewport — for route-level transitions. */
export function FullPageSpinner({ text }: { text?: string | null }) {
    return (
        <div className="grid min-h-dvh place-items-center bg-background">
            <Spinner text={text ?? null} />
        </div>
    );
}
