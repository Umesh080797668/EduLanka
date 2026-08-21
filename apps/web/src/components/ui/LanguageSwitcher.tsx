'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/cn';

const LOCALES = [
    { code: 'en', label: 'EN', title: 'English' },
    { code: 'si', label: 'සි', title: 'සිංහල' },
    { code: 'ta', label: 'த', title: 'தமிழ்' },
] as const;

export interface LanguageSwitcherProps {
    /** Use the sidebar palette instead of the card palette. */
    onDarkSurface?: boolean;
    className?: string;
}

export function LanguageSwitcher({
    onDarkSurface = false,
    className,
}: LanguageSwitcherProps) {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const handleChange = (newLocale: string) => {
        router.replace(pathname, { locale: newLocale });
    };

    return (
        <div
            role="radiogroup"
            aria-label="Language"
            className={cn(
                'inline-flex items-center gap-0.5 rounded-input p-0.5',
                onDarkSurface ? 'bg-sidebar-accent' : 'bg-muted',
                className,
            )}
        >
            <Globe
                aria-hidden
                className={cn(
                    'ml-1.5 mr-0.5 size-3.5 shrink-0',
                    onDarkSurface ? 'text-sidebar-muted' : 'text-muted-foreground',
                )}
            />
            {LOCALES.map((loc) => {
                const active = locale === loc.code;
                return (
                    <button
                        key={loc.code}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={loc.title}
                        lang={loc.code}
                        onClick={() => handleChange(loc.code)}
                        className={cn(
                            'rounded-[7px] px-2 py-1 text-xs font-semibold transition-colors',
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
                        {loc.label}
                        <span className="sr-only"> — {loc.title}</span>
                    </button>
                );
            })}
        </div>
    );
}
