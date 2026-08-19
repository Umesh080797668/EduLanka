'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Building2, UserCircle2, ArrowRight, ArrowLeft, Mail, Lock, User } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [tenants, setTenants] = useState<any[]>([]);
    const [loadingTenants, setLoadingTenants] = useState(true);

    // Form State
    const [tenantId, setTenantId] = useState('');
    const [role, setRole] = useState<'STUDENT' | 'PARENT'>('STUDENT');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Submit State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const res = await fetch('/api/v1/auth/tenants');
                if (res.ok) {
                    const data = await res.json();
                    setTenants(data.data || []);
                }
            } catch (err) {
                console.error("Failed to load public tenants", err);
            } finally {
                setLoadingTenants(false);
            }
        };
        fetchTenants();
    }, []);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/v1/auth/self-register', {
                credentials: 'include',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, fullName, tenantId, role })
            });

            if (res.ok) {
                const json = await res.json();
                const { accessToken, user } = json.data;
                const savedRole = user?.role || role;

                authManager.setAuth(accessToken, user?.tenantId || '', savedRole, user?.id || '');
                localStorage.setItem('role', savedRole);

                const route = `/${savedRole.toLowerCase()}`;
                router.push(route);
            } else {
                const errorData = await res.json();
                setError(errorData?.error?.message || errorData?.message || "Registration failed");
            }
        } catch (err: any) {
            setError(err.message || 'Network Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-900">
            {/* Vibrant Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/20 blur-[120px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/30 blur-[120px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[480px]"
            >
                <div className="backdrop-blur-xl bg-white/10 dark:bg-slate-900/50 border border-white/20 dark:border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
                    <div className="p-8 pb-6 border-b border-white/10">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30"
                        >
                            <UserCircle2 className="w-8 h-8 text-white" />
                        </motion.div>
                        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h1>
                        <p className="text-emerald-200/80 mt-2 font-medium">Join your school community in seconds.</p>
                    </div>

                    <div className="p-8 pt-6">
                        {loadingTenants ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-4" />
                                <p className="text-emerald-200/60 font-medium text-sm">Discovering schools...</p>
                            </div>
                        ) : tenants.length === 0 ? (
                            <div className="text-center py-8">
                                <Building2 className="w-12 h-12 text-slate-500 mx-auto mb-4 opacity-50" />
                                <p className="text-slate-300 font-medium mb-6">No schools are currently accepting self-enrollment.</p>
                                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Return to Login
                                </Link>
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl mb-6 flex items-start gap-3 backdrop-blur-md">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <p className="font-medium text-sm">{error}</p>
                                    </motion.div>
                                )}

                                <form onSubmit={handleSignup} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-slate-300">Select School</label>
                                        <select
                                            required
                                            value={tenantId}
                                            onChange={(e) => setTenantId(e.target.value)}
                                            className="w-full bg-slate-900/40 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                                        >
                                            <option value="" disabled>Choose your school...</option>
                                            {tenants.map(t => (
                                                <option key={t.id} value={t.id} className="bg-slate-800 text-white">{t.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5 pt-2 border-t border-white/10">
                                        <label className="block text-sm font-semibold text-slate-300">I am a...</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setRole('STUDENT')}
                                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${role === 'STUDENT' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-900/40 border-white/10 text-slate-400 hover:bg-slate-800'}`}
                                            >
                                                Student
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRole('PARENT')}
                                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${role === 'PARENT' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm' : 'bg-slate-900/40 border-white/10 text-slate-400 hover:bg-slate-800'}`}
                                            >
                                                Parent
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-slate-300">Full Name</label>
                                        <div className="relative">
                                            <User className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text" required
                                                value={fullName} onChange={e => setFullName(e.target.value)}
                                                className="w-full bg-slate-900/40 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-slate-300">Email Address</label>
                                        <div className="relative">
                                            <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="email" required
                                                value={email} onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-slate-900/40 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-semibold text-slate-300">Password</label>
                                        <div className="relative">
                                            <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="password" required minLength={8}
                                                value={password} onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-slate-900/40 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-500"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !tenantId}
                                        className={`
                                            w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all
                                            ${(loading || !tenantId)
                                                ? 'bg-emerald-500/50 text-white/50 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98]'
                                            }
                                        `}
                                    >
                                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                        <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                                        {!loading && <ArrowRight className="w-4 h-4 ml-1" />}
                                    </button>
                                </form>

                                <div className="mt-8 text-center text-sm font-medium text-slate-400">
                                    Already have an account?{' '}
                                    <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
                                        Sign in
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
