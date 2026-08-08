'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [tenantId, setTenantId] = useState('a1b2c3d4-0000-0000-0000-000000000001');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/v1/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenantId
                },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                setSuccess(true);
            } else {
                const errorData = await res.json();
                setError(errorData.message || 'Failed to request password reset.');
            }
        } catch (err: any) {
            setError(err.message || 'Network error while attempting to reset password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
            >
                <div className="p-8 text-center pt-10">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl mx-auto flex items-center justify-center mb-6">
                        <KeyRound className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</h1>
                    <p className="text-slate-500 mt-2 font-medium">Enter your email and school ID to receive instructions to reset your password.</p>
                </div>

                <div className="px-8 pb-8">
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

                    {success ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center"
                        >
                            <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl border border-emerald-100 mb-6">
                                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                                <h3 className="font-bold text-lg mb-1">Check your inbox</h3>
                                <p className="text-sm">We've sent a password reset link to <strong>{email}</strong>.</p>
                            </div>
                            <Link href="/login">
                                <button className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold hover:bg-slate-800 transition-colors shadow-sm">
                                    Return to Sign In
                                </button>
                            </Link>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">School ID</label>
                                <input
                                    type="text"
                                    required
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="e.g. a1b2c3d4-0000-0000-0000-000000000001"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="you@school.lk"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`
                                    w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm
                                    ${loading
                                        ? 'bg-indigo-400 text-white cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30'
                                    }
                                `}
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                                {loading ? 'Sending Instructions...' : 'Send Reset Link'}
                            </button>
                        </form>
                    )}

                    {!success && (
                        <p className="mt-8 text-center text-sm text-slate-500 font-medium">
                            <Link href="/login" className="text-slate-900 hover:text-indigo-600 font-bold transition-colors">
                                Cancel and return to login
                            </Link>
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
