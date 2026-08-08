'use client';

import { useState, useEffect } from 'react';
import { fetchUsers, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Loader2, ShieldCheck, CheckCircle2, XCircle, MoreVertical } from 'lucide-react';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const opts: RequestOpts = { token: 'DEMO', tenantId: 'DEMO' };
        fetchUsers(undefined, opts) // List all users
            .then(setUsers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Users className="w-6 h-6 text-indigo-600" />
                            User Management
                        </h2>
                        <p className="text-slate-500 mt-1">Manage all tenant users, their roles, and authentication status.</p>
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-center gap-3">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium text-sm">{error}</p>
                    </motion.div>
                )}

                <div className="overflow-hidden border border-slate-200 rounded-xl relative min-h-[400px]">
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center pointer-events-none"
                            >
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <table className="w-full text-left border-collapse bg-white">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4">Name & Email</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!loading && users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Users className="w-10 h-10 text-slate-300" />
                                            <p>No users found in this tenant.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user, idx) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                                        className="hover:bg-slate-50/60 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-indigo-100">
                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{user.full_name}</div>
                                                    <div className="text-sm text-slate-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold capitalize">
                                                {user.role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />}
                                                {user.role.toLowerCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                                                ${user.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'}
                                            `}>
                                                {user.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {user.is_active ? 'Active' : 'Deactivated'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-sm transition-all shadow-sm"
                                                    onClick={() => alert('Phase 1: Status toggle logic goes here')}
                                                >
                                                    {user.is_active ? 'Deactivate' : 'Reactivate'}
                                                </button>
                                                <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
