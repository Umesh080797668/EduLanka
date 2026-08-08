'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
    const router = useRouter();
    const t = useTranslations('Login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [tenantId, setTenantId] = useState('a1b2c3d4-0000-0000-0000-000000000001');
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
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenantId
                },
                body: JSON.stringify({ email, password, tenantId })
            });

            if (res.ok) {
                const json = await res.json();

                // Assuming Sprint 2 auth payload returns tokens and user info
                const { access_token, user } = json.data;
                const role = user?.role || 'STUDENT'; // Fallback role if undefined

                // Save to local storage for the rest of the app to consume
                localStorage.setItem('token', access_token);
                localStorage.setItem('tenantId', tenantId);
                localStorage.setItem('role', role);

                // Initial route resolution based on role
                let route = `/${role.toLowerCase()}`;
                if (role === 'SCHOOL_ADMIN') route = '/institution-admin';
                if (role === 'SUPER_ADMIN') route = '/system-admin';

                // Redirect user
                router.push(route);
            } else {
                const errorData = await res.json();
                setError(errorData.message || t('invalidCreds'));
            }
        } catch (err: any) {
            setError(err.message || t('networkError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
            >
                <div className="p-8 pb-6 bg-indigo-600 text-white text-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4 border border-white/20">
                        <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('welcome')}</h1>
                    <p className="text-indigo-200 mt-2 font-medium">{t('subtitle')}</p>
                </div>

                <div className="p-8 pt-6">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-start gap-3"
                        >
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="font-medium text-sm">{error}</p>
                        </motion.div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('schoolId')}</label>
                            <input
                                type="text"
                                required
                                value={tenantId}
                                onChange={(e) => setTenantId(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                placeholder={t('schoolIdPlaceholder')}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('email')}</label>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                placeholder={t('emailPlaceholder')}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-semibold text-slate-700">{t('password')}</label>
                                <Link href="/reset-password" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                                    {t('forgotPassword')}
                                </Link>
                            </div>
                            <input
                                type="password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`
                                w-full mt-2 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm
                                ${loading
                                    ? 'bg-indigo-400 text-white cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30'
                                }
                            `}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            {loading ? t('authenticating') : t('signIn')}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500 font-medium">
                        {t('noAccount')}{' '}
                        <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-bold ml-1">
                            {t('registerHere')}
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
