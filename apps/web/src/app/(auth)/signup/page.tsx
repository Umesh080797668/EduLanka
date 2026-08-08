'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('STUDENT');
    const [tenantId, setTenantId] = useState('DEMO');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/v1/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': tenantId
                },
                body: JSON.stringify({ email, password, full_name: fullName, role })
            });

            if (res.ok) {
                // Route to login on successful creation
                router.push('/login');
            } else {
                const errorData = await res.json();
                setError(errorData.message || 'Failed to create account. Please try again.');
            }
        } catch (err: any) {
            setError(err.message || 'Network error while attempting to sign up.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
            >
                <div className="p-8 pb-6 bg-slate-800 text-white text-center">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4 border border-white/10">
                        <UserPlus className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Create an Account</h1>
                    <p className="text-slate-300 mt-2 font-medium">Register for your school portal</p>
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

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">School ID</label>
                                <input
                                    type="text"
                                    required
                                    value={tenantId}
                                    onChange={(e) => setTenantId(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                    placeholder="e.g. DEMO"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Portal Role</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                >
                                    <option value="STUDENT">Student</option>
                                    <option value="PARENT">Parent</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                placeholder="Your Name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                placeholder="you@school.lk"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                placeholder="Create a secure password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`
                                w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold transition-all shadow-sm
                                ${loading
                                    ? 'bg-slate-400 text-white cursor-not-allowed'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20'
                                }
                            `}
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            {loading ? 'Registering...' : 'Complete Registration'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-500 font-medium">
                        Already registered?{' '}
                        <Link href="/login" className="text-slate-900 hover:text-indigo-600 font-bold ml-1 transition-colors">
                            Sign In Here
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
