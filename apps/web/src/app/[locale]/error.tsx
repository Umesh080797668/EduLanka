'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations('ErrorBoundary');

    useEffect(() => {
        console.error('Next.js caught an error:', error);
    }, [error]);

    return (
        <div className="grid min-h-dvh place-items-center bg-background p-4">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-md rounded-card border border-border bg-card p-8 text-center shadow-card"
            >
                <div className="mx-auto mb-6 grid size-14 place-items-center rounded-full bg-destructive-subtle text-destructive">
                    <AlertCircle className="size-7" />
                </div>

                <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {t('title')}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t('subtitle')}
                </p>

                {error.digest && (
                    <p className="mt-4 rounded-input bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {error.digest}
                    </p>
                )}

                <Button
                    onClick={() => reset()}
                    leadingIcon={<RotateCcw />}
                    block
                    size="lg"
                    className="mt-7"
                >
                    {t('tryAgain')}
                </Button>
            </motion.div>
        </div>
    );
}
