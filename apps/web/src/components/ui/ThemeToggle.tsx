'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'edulanka-theme';

/**
 * Inline script injected before paint so the correct theme class is on <html>
 * on the very first frame — otherwise dark-mode users get a white flash.
 * Kept in sync with `applyTheme` below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var p=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=p==='dark'||((!p||p==='system')&&d);document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){}})();`;

function applyTheme(preference: ThemePreference): void {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = preference === 'dark' || (preference === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function useTheme() {
    const [preference, setPreference] = React.useState<ThemePreference>('system');

    React.useEffect(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            setPreference(stored);
        }
    }, []);

    // Follow the OS while the preference is "system".
    React.useEffect(() => {
        if (preference !== 'system') return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => applyTheme('system');
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [preference]);

    const setTheme = React.useCallback((next: ThemePreference) => {
        setPreference(next);
        localStorage.setItem(THEME_STORAGE_KEY, next);
        applyTheme(next);
    }, []);

    return { preference, setTheme };
}

const OPTIONS: { value: ThemePreference; icon: React.ElementType; labelKey: string }[] = [
    { value: 'light', icon: Sun, labelKey: 'light' },
    { value: 'dark', icon: Moon, labelKey: 'dark' },
    { value: 'system', icon: Monitor, labelKey: 'system' },
];

export interface ThemeToggleProps {
    /** `segmented` shows all three options; `icon` cycles light → dark → system. */
    variant?: 'segmented' | 'icon';
    /** Use the sidebar palette instead of the card palette. */
    onDarkSurface?: boolean;
    className?: string;
}

export function ThemeToggle({
    variant = 'segmented',
    onDarkSurface = false,
    className,
}: ThemeToggleProps) {
    const { preference, setTheme } = useTheme();
    const t = useTranslations('Theme');

    if (variant === 'icon') {
        const order: ThemePreference[] = ['light', 'dark', 'system'];
        const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2]!;
        const Icon = current.icon;

        return (
            <button
                type="button"
                onClick={() => {
                    const next = order[(order.indexOf(preference) + 1) % order.length]!;
                    setTheme(next);
                }}
                title={t(current.labelKey)}
                aria-label={t('toggle')}
                className={cn(
                    'grid size-9 place-items-center rounded-input text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    className,
                )}
            >
                <Icon className="size-[18px]" />
            </button>
        );
    }

    return (
        <div
            role="radiogroup"
            aria-label={t('toggle')}
            className={cn(
                'inline-flex items-center gap-0.5 rounded-input p-0.5',
                onDarkSurface ? 'bg-sidebar-accent' : 'bg-muted',
                className,
            )}
        >
            {OPTIONS.map(({ value, icon: Icon, labelKey }) => {
                const active = preference === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={t(labelKey)}
                        onClick={() => setTheme(value)}
                        className={cn(
                            'grid size-7 place-items-center rounded-[7px] transition-colors',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                            active
                                ? onDarkSurface
                                    ? 'bg-sidebar-active text-sidebar-active-foreground'
                                    : 'bg-card text-foreground shadow-xs'
                                : onDarkSurface
                                    ? 'text-sidebar-muted hover:text-sidebar-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <Icon className="size-4" />
                        <span className="sr-only">{t(labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
}
