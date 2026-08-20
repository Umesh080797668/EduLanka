'use client';

import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft, MessageSquare, Send, CheckCircle2, Loader2, Info } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { apiClient } from '@/lib/api-client';

function DeactivatedContent() {
    const searchParams = useSearchParams();
    const role = searchParams?.get('role') || '';
    const tenantId = searchParams?.get('tenantId');
    const userId = searchParams?.get('userId');
    const reason = searchParams?.get('reason');

    const isSchoolAdmin = role === 'SCHOOL_ADMIN';

    const [isAppealing, setIsAppealing] = useState(false);
    const [appealText, setAppealText] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmitAppeal = async () => {
        if (!appealText.trim() || !tenantId || !userId) return;
        setStatus('loading');
        try {
            await apiClient.post('/auth/inquiries',
                { tenantId, userId, role, message: appealText.trim() },
                { skipGlobalToast: true }
            );
            setStatus('success');
            import('sonner').then(({ toast }) => {
                toast.success('Inquiry Forwarded', {
                    description: 'Your appeal has been safely sent to an administrator.'
                });
            });
        } catch (err: any) {
            setStatus('error');
            const msg = err.message || 'Failed to submit inquiry';
            setErrorMsg(msg);
            import('sonner').then(({ toast }) => {
                toast.error('Inquiry Submission Failed', { description: msg });
            });
        }
    };

    return (
        <div className="backdrop-blur-xl bg-white/10 dark:bg-slate-900/50 border border-white/20 dark:border-slate-800/80 rounded-3xl shadow-2xl p-8 sm:p-10 w-full max-w-lg mx-auto">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="w-20 h-20 bg-rose-500/10 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-inner"
            >
                <ShieldAlert className="w-10 h-10 text-rose-500" />
            </motion.div>

            <h1 className="text-3xl font-extrabold text-white text-center tracking-tight mb-3">
                Account Suspended
            </h1>

            <p className="text-slate-300 text-center font-medium leading-relaxed mb-6">
                Your access to the EduLanka portal has been revoked.
            </p>

            {reason && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6 flex gap-3 text-left">
                    <Info className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                        <span className="block text-rose-300 text-xs font-bold uppercase tracking-wider mb-1">Reason for suspension</span>
                        <p className="text-rose-100 text-sm leading-relaxed">{reason}</p>
                    </div>
                </div>
            )}

            {!isAppealing && status !== 'success' && (
                <div className="space-y-3 mb-8">
                    <button
                        onClick={() => setIsAppealing(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 text-white transition-all"
                    >
                        <MessageSquare className="w-5 h-5" />
                        <span>Submit an Inquiry</span>
                    </button>
                    {!isSchoolAdmin && (
                        <p className="text-xs text-center text-slate-400 font-medium px-4">
                            Your inquiry will be sent securely to your school administrators.
                        </p>
                    )}
                </div>
            )}

            {isAppealing && status !== 'success' && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mb-8"
                >
                    <textarea
                        autoFocus
                        rows={4}
                        placeholder="Please explain why you believe this is an error or ask for clarification..."
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all placeholder:text-slate-500"
                        value={appealText}
                        onChange={(e) => setAppealText(e.target.value)}
                        disabled={status === 'loading'}
                    />

                    {status === 'error' && (
                        <p className="text-rose-400 text-xs font-medium mt-2 mb-1">{errorMsg}</p>
                    )}

                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => { setIsAppealing(false); setStatus('idle'); }}
                            disabled={status === 'loading'}
                            className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-white transition-all text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmitAppeal}
                            disabled={status === 'loading' || !appealText.trim()}
                            className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white transition-all text-sm"
                        >
                            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            <span>Send Message</span>
                        </button>
                    </div>
                </motion.div>
            )}

            {status === 'success' && (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mb-8 bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-xl flex flex-col items-center justify-center text-center gap-3"
                >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h4 className="text-emerald-300 font-bold mb-1">Inquiry Submitted</h4>
                        <p className="text-emerald-100/70 text-sm">Your message has been forwarded safely.</p>
                    </div>
                </motion.div>
            )}

            <Link
                href="/login"
                className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold border border-white/10 text-white transition-all w-full
                    ${isAppealing || status === 'success' ? 'bg-transparent hover:bg-white/5' : 'bg-white/10 hover:bg-white/20'}`}
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
                className="w-full max-w-[600px] flex justify-center"
            >
                <Suspense fallback={<div className="h-64 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin text-white/50" /></div>}>
                    <DeactivatedContent />
                </Suspense>
            </motion.div>
        </div>
    );
}
