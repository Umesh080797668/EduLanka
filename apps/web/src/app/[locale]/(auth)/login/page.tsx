'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('Login');
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ identifier, password })
            });

            if (res.ok) {
                const json = await res.json();

                // Assuming Sprint 2 auth payload returns tokens and user info
                const { access_token, user } = json.data;
                const role = user?.role || 'STUDENT'; // Fallback role if undefined

                // Save to local storage for the rest of the app to consume
                localStorage.setItem('token', access_token);
                localStorage.setItem('tenantId', user.tenantId);
                localStorage.setItem('role', role);

                // Initial route resolution based on role
                let route = `/${role.toLowerCase()}`;
                if (role === 'SCHOOL_ADMIN') route = '/institution-admin';
                if (role === 'SUPER_ADMIN') route = '/system-admin';

                // Redirect user
                router.push(route);
            } else {
                const errorData = await res.json();
                const backendMessage = errorData?.error?.message || errorData?.message;

                if (backendMessage && backendMessage.startsWith('User account is deactivated|')) {
                    try {
                        const payloadStr = backendMessage.split('|')[1];
                        const payload = JSON.parse(payloadStr);
                        router.push(`/deactivated?role=${payload.role}&tenantId=${payload.tenantId}&userId=${payload.userId}&reason=${encodeURIComponent(payload.reason || '')}`);
                    } catch (e) {
                        router.push(`/deactivated?role=STUDENT`);
                    }
                    return;
                }

                setError(backendMessage || t('invalidCreds'));
            }
        } catch (err: any) {
            setError(err.message || t('networkError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-900">
            {/* Vibrant Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/30 blur-[120px]" />
                <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-violet-600/20 blur-[120px]" />
                <div className="absolute top-[20%] left-[60%] w-[30%] h-[30%] rounded-full bg-blue-500/20 blur-[100px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[440px]"
            >
                {/* Glassmorphic Card */}
                <div className="backdrop-blur-xl bg-white/10 dark:bg-slate-900/50 border border-white/20 dark:border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="p-10 text-center">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30"
                        >
                            <GraduationCap className="w-10 h-10 text-white" />
                        </motion.div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">{t('welcome')}</h1>
                        <p className="text-indigo-200/80 mt-2 font-medium">{t('subtitle')}</p>
                    </div>

                    <div className="px-10 pb-10">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl mb-6 flex items-start gap-3 backdrop-blur-md"
                            >
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p className="font-medium text-sm">{error}</p>
                            </motion.div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-slate-300">Email, Phone, or Admission No</label>
                                <input
                                    type="text"
                                    required
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full bg-slate-900/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-500"
                                    placeholder="e.g. admin@school.edu.lk / +9477... / 1004"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-semibold text-slate-300">{t('password')}</label>
                                    <Link href="/reset-password" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                                        {t('forgotPassword')}
                                    </Link>
                                </div>
                                <input
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-500"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`
                                    w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all
                                    ${loading
                                        ? 'bg-indigo-500/50 text-white/50 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]'
                                    }
                                `}
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                <span>{loading ? t('authenticating') : t('signIn')}</span>
                            </button>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
