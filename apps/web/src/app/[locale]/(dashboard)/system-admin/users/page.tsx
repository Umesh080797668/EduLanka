'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { fetchGlobalUsers, setUserActive, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Loader2, ShieldCheck, CheckCircle2, XCircle, MoreVertical, Database } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

function AuditLogFetcher({ targetUserId }: { targetUserId: string }) {
    const te = useTranslations('SystemAdminUsersExtras');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        fetch(`/api/v1/audit-logs?limit=20&offset=0&targetUserId=${targetUserId}`, {
            credentials: 'include',
            headers: { 'X-Tenant-Id': authManager.getTenantId() || '' }
        })
            .then(res => res.json())
            .then(json => { if (isMounted) setLogs(json.data?.data || []) })
            .catch(() => { })
            .finally(() => { if (isMounted) setLoading(false); });
        return () => { isMounted = false; };
    }, [targetUserId]);

    const getActionColor = (action: string) => {
        if (action.includes('PROVISION') || action.includes('CREATE')) return 'bg-emerald-100 text-emerald-700';
        if (action.includes('DELETE') || action.includes('DISABLE')) return 'bg-red-100 text-red-700';
        if (action.includes('UPDATE') || action.includes('CHANGE')) return 'bg-amber-100 text-amber-700';
        return 'bg-blue-100 text-blue-700';
    };

    if (loading) return <div className="p-12 text-center flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /><span className="text-sm font-medium text-slate-400">{te('loadingAuditStreams')}</span></div>;
    if (logs.length === 0) return <div className="p-8 text-center text-slate-500 font-medium">{te('noAuditLogs')}</div>;

    return (
        <table className="w-full text-left bg-white text-sm">
            <tbody className="divide-y divide-slate-100">
                {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${getActionColor(log.action)}`}>
                                {log.action.replace(/_/g, ' ')}
                            </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px] truncate w-24">({log.entity_type}) {log.entity_id}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{log.ip_address || 'SYS'}</td>
                        <td className="py-3 px-4 text-slate-500 text-right text-xs">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function SystemAdminUsersPage() {
    const t = useTranslations('InstitutionAdminUsers');
    const te = useTranslations('SystemAdminUsersExtras');
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState(searchParams?.get('query') || '');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userToConfirm, setUserToConfirm] = useState<any | null>(null);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [activeStep, setActiveStep] = useState<1 | 2>(1);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [auditLogTarget, setAuditLogTarget] = useState<any | null>(null);

    const refreshUsers = () => {
        setLoading(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
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
        const targetTenantId = userToConfirm.tenant_id || authManager.getTenantId() || '';
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: targetTenantId };

        try {
            await setUserActive(userToConfirm.id, !userToConfirm.is_active, opts, deactivationReason);
            await refreshUsers();
        } catch (e: any) {
            setError(e.message || 'Failed to update user status');
        } finally {
            setActionLoading(null);
            setUserToConfirm(null);
            setDeactivationReason('');
            setActiveStep(1);
            setActiveDropdown(null);
        }
    };

    const handleActionClick = (user: any) => {
        if (user.role === 'SUPER_ADMIN') return;
        setUserToConfirm(user);
        setDeactivationReason('');
        setActiveStep(1);
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
                            {te('globalEndUsers')}
                        </h1>
                        <p className="text-slate-500 mt-1">{te('globalEndUsersDesc')}</p>
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={te('searchPlaceholder')}
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
                                    {userToConfirm.is_active ? te('deactivateUserPrompt') : te('reactivateUserPrompt')}
                                </h3>

                                {activeStep === 1 && (
                                    <>
                                        <p className="text-slate-500 text-sm mb-6">
                                            {te('areYouSure')}{userToConfirm.is_active ? te('deactivateText') : te('reactivateText')}{te('theAccountFor')}<strong className="text-slate-700">{userToConfirm.full_name}</strong>
                                            {userToConfirm.is_active ? te('loseAccessWarning') : te('regainAccessWarning')}
                                        </p>
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                onClick={() => setUserToConfirm(null)}
                                                className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
                                            >
                                                {te('cancel')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (userToConfirm.is_active) {
                                                        setActiveStep(2);
                                                    } else {
                                                        confirmToggleStatus();
                                                    }
                                                }}
                                                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${userToConfirm.is_active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                            >
                                                {userToConfirm.is_active ? te('proceedToDeactivate') : te('yesReactivate')}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {activeStep === 2 && (
                                    <>
                                        <p className="text-slate-500 text-sm mb-4">
                                            {te('deactivationReasonPrompt')}
                                        </p>
                                        <textarea
                                            rows={3}
                                            placeholder={te('enterReason')}
                                            value={deactivationReason}
                                            onChange={(e) => setDeactivationReason(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 mb-6 resize-none"
                                        />
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                onClick={() => setActiveStep(1)}
                                                disabled={actionLoading === userToConfirm.id}
                                                className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
                                            >
                                                {te('back')}
                                            </button>
                                            <button
                                                onClick={confirmToggleStatus}
                                                disabled={actionLoading === userToConfirm.id}
                                                className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                                            >
                                                {actionLoading === userToConfirm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                {te('confirmDeactivation')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Audit Log Placeholder Modal */}
                <AnimatePresence>
                    {auditLogTarget && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        <Database className="w-5 h-5 text-indigo-500" />
                                        {te('auditSequence')} <span className="font-mono text-lg">{auditLogTarget.full_name}</span>
                                    </h3>
                                    <button onClick={() => setAuditLogTarget(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500">
                                        <XCircle className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto pr-2 rounded-xl border border-slate-200">
                                    <AuditLogFetcher targetUserId={auditLogTarget.id} />
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
                                            <p>{searchQuery ? te('noUsersMatching') : t('noUsers')}</p>
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
                                                {user.role !== 'SUPER_ADMIN' && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDropdown(activeDropdown === user.id ? null : user.id);
                                                            }}
                                                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white"
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
                                                                        <button onClick={() => { setActiveDropdown(null); handleActionClick(user); }} className={`px-4 py-3 text-sm text-left hover:bg-slate-50 border-b border-slate-100 font-medium ${user.is_active ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                            {user.is_active ? te('deactivateAccountBtn') : te('reactivateAccountBtn')}
                                                                        </button>
                                                                        <button onClick={() => { setActiveDropdown(null); setAuditLogTarget(user); }} className="px-4 py-3 text-sm text-left hover:bg-slate-50 font-medium text-slate-600 flex items-center justify-between">
                                                                            {te('viewAuditLogsBtn')}
                                                                            <ShieldCheck className="w-4 h-4 text-slate-300" />
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
