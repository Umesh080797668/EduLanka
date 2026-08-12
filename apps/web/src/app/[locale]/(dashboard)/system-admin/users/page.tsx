'use client';

import { useState, useEffect } from 'react';
import { fetchGlobalUsers, setUserActive, toggleTenantSms, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Loader2, ShieldCheck, CheckCircle2, XCircle, MoreVertical, Database, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SystemAdminUsersPage() {
    const t = useTranslations('InstitutionAdminUsers');
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refreshUsers = () => {
        setLoading(true);
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        fetchGlobalUsers(opts)
            .then(setUsers)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refreshUsers();
    }, []);

    const toggleUserStatus = async (user: any) => {
        // System admin can technically disable school admins or other users, but block super admin self-disable
        if (user.role === 'SUPER_ADMIN') return;

        setActionLoading(user.id);
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            await setUserActive(user.id, !user.is_active, opts);
            await refreshUsers();
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSmsToggle = async (tenantId: string) => {
        setActionLoading(`sms-${tenantId}`);
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: localStorage.getItem('tenantId') || '' };
        try {
            await toggleTenantSms(tenantId, opts);
            await refreshUsers();
        } catch (e: any) {
            setError(e.message || 'Failed to toggle SMS feature');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredUsers = users.filter(u =>
        (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (u.tenants?.slug?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                            <Database className="w-6 h-6 text-purple-600" />
                            Global End-Users Directory
                        </h1>
                        <p className="text-slate-500 mt-1">Cross-tenant administrative overview of all identities across the infrastructure.</p>
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, email or tenant..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-rose-50 text-rose-700 rounded-xl mb-6 border border-rose-100 flex items-center gap-3">
                        <XCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium text-sm">{error}</p>
                    </motion.div>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-xl relative min-h-[400px]">
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center pointer-events-none"
                            >
                                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <table className="w-full text-left border-collapse bg-white min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4">{t('nameEmail')}</th>
                                <th className="px-6 py-4">Tenant</th>
                                <th className="px-6 py-4">{t('role')}</th>
                                <th className="px-6 py-4">{t('status')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!loading && filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Users className="w-10 h-10 text-slate-300" />
                                            <p>{searchQuery ? 'No users matching search.' : t('noUsers')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, idx) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                                        className="hover:bg-slate-50/60 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-purple-100">
                                                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors">{user.full_name}</div>
                                                    <div className="text-sm text-slate-500">{user.email || user.phone_number || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold font-mono">
                                                    {user.tenants?.slug || 'SysRoot'}
                                                </span>
                                                {user.tenants && (
                                                    <button
                                                        disabled={actionLoading === `sms-${user.tenants.id}`}
                                                        onClick={() => handleSmsToggle(user.tenants.id)}
                                                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-all flex items-center justify-center gap-1 ${user.tenants.sms_approved
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                                            }`}
                                                        title="Toggle Tenant SMS System Limits"
                                                    >
                                                        {actionLoading === `sms-${user.tenants.id}` ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Smartphone className="w-3 h-3" />
                                                        )}
                                                        {user.tenants.sms_approved ? 'SMS OK' : 'SMS OFF'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold capitalize">
                                                {user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN' ? (
                                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                                                ) : null}
                                                {user.role.toLowerCase().replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                                            ${user.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'}
                                        `}>
                                                {user.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {user.is_active ? t('active') : t('deactivated')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    disabled={user.role === 'SUPER_ADMIN' || actionLoading === user.id}
                                                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shadow-sm flex items-center justify-center min-w-[90px]
                                                        ${user.role === 'SUPER_ADMIN' ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' :
                                                            'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-slate-200'}`}
                                                    onClick={() => toggleUserStatus(user)}
                                                >
                                                    {actionLoading === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : user.is_active ? t('deactivate') : t('reactivate')}
                                                </button>
                                                {user.role !== 'SUPER_ADMIN' && (
                                                    <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                )}
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
