'use client';

import { motion } from 'framer-motion';
import { SearchX, Home } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

export default function NotFound() {
    const t = useTranslations('NotFound');

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100"
            >
                <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3">
                    <SearchX className="w-10 h-10" />
                </div>
                <h1 className="text-6xl font-black text-slate-200 mb-2 tracking-tighter">404</h1>
                <h2 className="text-2xl font-bold text-slate-800 mb-3">{t('title')}</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    {t('longDescription')}
                </p>
                <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors"
                >
                    <Home className="w-5 h-5" />
                    {t('returnHome')}
                </Link>
            </motion.div>
        </div>
    );
}
