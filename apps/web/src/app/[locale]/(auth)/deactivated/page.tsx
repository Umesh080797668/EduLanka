'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function DeactivatedContent() {
    const searchParams = useSearchParams();
    const role = searchParams?.get('role') || '';
    const isSchoolAdmin = role === 'SCHOOL_ADMIN';

    return (
        <div className="backdrop-blur-xl bg-white/10 dark:bg-slate-900/50 border border-white/20 dark:border-slate-800/80 rounded-3xl shadow-2xl p-10 text-center">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="w-20 h-20 bg-rose-500/10 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-inner"
            >
                <ShieldAlert className="w-10 h-10 text-rose-500" />
            </motion.div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-3">
                Account Deactivated
            </h1>

            <p className="text-slate-300 font-medium leading-relaxed mb-8">
                Your access to the EduLanka portal has been revoked.
                {isSchoolAdmin
                    ? " Please contact the EduLanka platform system administrators (support@edulanka.com) for assistance."
                    : " If you believe this is an error, please contact your institution's support for assistance."
                }
            </p>

            <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all w-full"
            >
                <ArrowLeft className="w-5 h-5" />
                <span>Return to Login</span>
            </Link>
        </div>
    );
}

export default function DeactivatedAccountPage() {
    return (
        <div className="min-h-[80vh] relative flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[480px]"
            >
                <Suspense fallback={<div className="h-64 flex items-center justify-center text-white"><ShieldAlert className="w-8 h-8 animate-pulse text-white/50" /></div>}>
                    <DeactivatedContent />
                </Suspense>
            </motion.div>
        </div>
    );
}
