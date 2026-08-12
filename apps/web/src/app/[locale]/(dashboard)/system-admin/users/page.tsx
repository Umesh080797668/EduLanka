'use client';

import { useState, useEffect } from 'react';
import { fetchGlobalUsers, setUserActive, toggleTenantSms, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Loader2, ShieldCheck, CheckCircle2, XCircle, MoreVertical, Database, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

export default function SystemAdminUsersPage() {
    const t = useTranslations('InstitutionAdminUsers');
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState(searchParams?.get('query') || '');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userToConfirm, setUserToConfirm] = useState<any | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

    // Sync external URI changes onto local frame
    useEffect(() => {
        const query = searchParams?.get('query');
        if (query !== null && query !== undefined) {
            setSearchQuery(query);
        }
    }, [searchParams]);

    const confirmToggleStatus = async () => {
        if (!userToConfirm) return;

        setActionLoading(userToConfirm.id);
        const targetTenantId = userToConfirm.tenant_id || localStorage.getItem('tenantId') || '';
        const opts: RequestOpts = { token: localStorage.getItem('token') || '', tenantId: targetTenantId };

        try {
            await setUserActive(userToConfirm.id, !userToConfirm.is_active, opts);
            await refreshUsers();
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(null);
            setUserToConfirm(null);
            setActiveDropdown(null);
        }
    };

    const handleActionClick = (user: any) => {
        if (user.role === 'SUPER_ADMIN') return;
        setUserToConfirm(user);
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

                {/* Confirmation Modal */}
                <AnimatePresence>
                    {userToConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                            >
                                <h3 className="text-xl font-bold text-slate-900 mb-2">
                                    {userToConfirm.is_active ? 'Deactivate User?' : 'Reactivate User?'}
                                </h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Are you sure you want to {userToConfirm.is_active ? 'deactivate' : 'reactivate'} the account for <strong className="text-slate-700">{userToConfirm.full_name}</strong>?
                                    {userToConfirm.is_active ? ' They will instantly lose access to the EduLanka portal.' : ' They will regain portal access.'}
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setUserToConfirm(null)}
                                        className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmToggleStatus}
                                        disabled={actionLoading === userToConfirm.id}
                                        className={`px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${userToConfirm.is_active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                                            }`}
                                    >
                                        {actionLoading === userToConfirm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        {userToConfirm.is_active ? 'Yes, Deactivate' : 'Yes, Reactivate'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

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
                                            <div className="flex items-center justify-end gap-2 relative">
                                                <button
                                                    disabled={user.role === 'SUPER_ADMIN' || actionLoading === user.id}
                                                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shadow-sm flex items-center justify-center min-w-[90px]
                                                        ${user.role === 'SUPER_ADMIN' ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' :
                                                            'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-slate-200'}`}
                                                    onClick={() => handleActionClick(user)}
                                                >
                                                    {actionLoading === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : user.is_active ? t('deactivate') : t('reactivate')}
                                                </button>
                                                {user.role !== 'SUPER_ADMIN' && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdown(activeDropdown === user.id ? null : user.id);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>

                                                        <AnimatePresence>
                                                            {activeDropdown === user.id && (
                                                                <>
                                                                    <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />
                                                                    <motion.div
                                                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                        exit={{ opacity: 0, scale: 0.95 }}
                                                                        className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden flex flex-col"
                                                                    >
                                                                        <button onClick={() => { setActiveDropdown(null); handleActionClick(user); }} className="px-4 py-2.5 text-sm text-left hover:bg-slate-50 border-b border-slate-100 font-medium text-slate-700">
                                                                            {user.is_active ? 'Deactivate Account' : 'Reactivate Account'}
                                                                        </button>
                                                                        <button onClick={() => setActiveDropdown(null)} className="px-4 py-2.5 text-sm text-left hover:bg-slate-50 font-medium text-slate-500">
                                                                            View Audit Logs
                                                                        </button>
                                                                    </motion.div>
                                                                </>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
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
