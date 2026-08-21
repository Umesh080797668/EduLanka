'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string = string> {
    value: T;
    label: React.ReactNode;
    icon?: React.ReactNode;
    /** Trailing count chip. */
    count?: number;
    disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
    items: readonly TabItem<T>[];
    value: T;
    onValueChange: (value: T) => void;
    /** `underline` for page-level sections, `pill` for compact filters. */
    variant?: 'underline' | 'pill';
    className?: string;
    'aria-label'?: string;
}

export function Tabs<T extends string = string>({
    items,
    value,
    onValueChange,
    variant = 'underline',
    className,
    ...aria
}: TabsProps<T>) {
    if (variant === 'pill') {
        return (
            <div
                role="tablist"
                aria-label={aria['aria-label']}
                className={cn(
                    'inline-flex items-center gap-1 rounded-input bg-muted p-1',
                    className,
                )}
            >
                {items.map((item) => {
                    const active = item.value === value;
                    return (
                        <button
                            key={item.value}
                            role="tab"
                            type="button"
                            aria-selected={active}
                            disabled={item.disabled}
                            onClick={() => onValueChange(item.value)}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold',
                                'transition-colors duration-150',
                                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                'disabled:pointer-events-none disabled:opacity-50',
                                '[&_svg]:size-4',
                                active
                                    ? 'bg-card text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {item.icon}
                            {item.label}
                            {typeof item.count === 'number' && (
                                <span className="numeric ml-0.5 text-[11px] font-bold opacity-60">
                                    {item.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    }

    return (
        <div
            role="tablist"
            aria-label={aria['aria-label']}
            className={cn(
                'scrollbar-none flex items-center gap-1 overflow-x-auto border-b border-border',
                className,
            )}
        >
            {items.map((item) => {
                const active = item.value === value;
                return (
                    <button
                        key={item.value}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        disabled={item.disabled}
                        onClick={() => onValueChange(item.value)}
                        className={cn(
                            'relative inline-flex shrink-0 items-center gap-2 px-3.5 pb-3 pt-2 text-sm font-semibold',
                            'transition-colors duration-150',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            'disabled:pointer-events-none disabled:opacity-50',
                            '[&_svg]:size-4',
                            active
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {item.icon}
                        {item.label}
                        {typeof item.count === 'number' && (
                            <span
                                className={cn(
                                    'numeric rounded-pill px-1.5 py-0.5 text-[11px] font-bold',
                                    active
                                        ? 'bg-primary-subtle text-primary-subtle-foreground'
                                        : 'bg-muted text-muted-foreground',
                                )}
                            >
                                {item.count}
                            </span>
                        )}
                        {active && (
                            <span
                                className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-t-full bg-primary"
                                aria-hidden
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
