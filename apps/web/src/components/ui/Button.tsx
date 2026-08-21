'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'subtle'
    | 'destructive'
    | 'link';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const BASE =
    'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-input font-semibold ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    'disabled:pointer-events-none disabled:opacity-55 active:translate-y-px ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0';

const VARIANTS: Record<ButtonVariant, string> = {
    primary:
        'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
    secondary:
        'bg-secondary text-secondary-foreground shadow-xs hover:bg-border',
    outline:
        'border border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground',
    ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    subtle:
        'bg-primary-subtle text-primary-subtle-foreground hover:brightness-[0.97] dark:hover:brightness-125',
    destructive:
        'bg-destructive text-destructive-foreground shadow-xs hover:brightness-95 dark:hover:brightness-110',
    link: 'text-primary underline-offset-4 hover:underline active:translate-y-0',
};

const SIZES: Record<ButtonSize, string> = {
    xs: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
    sm: 'h-9 px-3 text-[13px] [&_svg]:size-4',
    md: 'h-10 px-4 text-sm [&_svg]:size-4',
    lg: 'h-11 px-6 text-[15px] [&_svg]:size-[18px]',
    icon: 'size-10 [&_svg]:size-[18px]',
    'icon-sm': 'size-9 [&_svg]:size-4',
};

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows a spinner and blocks interaction. */
    loading?: boolean;
    /** Stretch to the container width. */
    block?: boolean;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    function Button(
        {
            className,
            variant = 'primary',
            size = 'md',
            loading = false,
            block = false,
            leadingIcon,
            trailingIcon,
            disabled,
            children,
            type = 'button',
            ...props
        },
        ref,
    ) {
        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || loading}
                aria-busy={loading || undefined}
                className={cn(
                    BASE,
                    VARIANTS[variant],
                    SIZES[size],
                    block && 'w-full',
                    className,
                )}
                {...props}
            >
                {loading ? (
                    <Loader2 className="animate-spin" aria-hidden />
                ) : (
                    leadingIcon
                )}
                {children}
                {!loading && trailingIcon}
            </button>
        );
    },
);

/**
 * Same visual language as `Button`, for use on `<a>` / `next-intl` `<Link>`.
 * Spread onto the link: `<Link className={buttonClass({ variant: 'primary' })}>`.
 */
export function buttonClass({
    variant = 'primary',
    size = 'md',
    block = false,
    className,
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
    className?: string;
} = {}): string {
    return cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
    );
}
