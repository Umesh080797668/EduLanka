'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RotateCcw } from 'lucide-react';

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
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100"
            >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">{t('title') || 'Something went wrong!'}</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    {t('subtitle') || 'A critical error occurred while trying to render this section. We apologize for the inconvenience.'}
                </p>
                <button
                    onClick={() => reset()}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
                >
                    <RotateCcw className="w-5 h-5" />
                    {t('tryAgain') || 'Try Again'}
                </button>
            </motion.div>
        </div>
    );
}
