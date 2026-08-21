'use client';

import { motion } from 'framer-motion';
import { Home, SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { buttonClass } from '@/components/ui/Button';

export default function NotFound() {
    const t = useTranslations('NotFound');

    return (
        <div className="relative isolate grid min-h-dvh place-items-center bg-background p-4">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] hero-glow"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-md rounded-card border border-border bg-card p-8 text-center shadow-card"
            >
                <div className="mx-auto mb-6 grid size-16 rotate-3 place-items-center rounded-card bg-muted text-muted-foreground">
                    <SearchX className="size-8" />
                </div>

                <p className="numeric text-5xl font-black tracking-tighter text-border-strong">
                    404
                </p>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">
                    {t('title')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t('longDescription')}
                </p>

                <Link
                    href="/"
                    className={buttonClass({ size: 'lg', block: true, className: 'mt-7' })}
                >
                    <Home className="size-[18px]" />
                    {t('returnHome')}
                </Link>
            </motion.div>
        </div>
    );
}
