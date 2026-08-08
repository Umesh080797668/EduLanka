'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function SignupPage() {
    const t = useTranslations('Signup');
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden text-center"
            >
                <div className="p-10 pb-8 bg-slate-800 text-white">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-6 border border-white/10">
                        <ShieldAlert className="w-8 h-8 text-amber-400" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight mb-2">{t('title')}</h1>
                    <p className="text-slate-300 font-medium">{t('subtitle')}</p>
                </div>
                <div className="p-8">
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        {t('description')} <br /><br />
                        {t('contactAdmin')}
                    </p>
                    <Link href="/login">
                        <button className="w-full bg-slate-900 text-white rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-sm">
                            <ArrowLeft className="w-5 h-5" />
                            {t('returnLogin')}
                        </button>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
