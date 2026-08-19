'use client';
import { authManager } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { fetchTenants, toggleTenantSms, RequestOpts } from '@/lib/api/school';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Search, Loader2, CheckCircle2, XCircle, ShieldCheck, Smartphone, Settings2, MoreVertical } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { TenantStatus } from '@edu-lanka/shared-types';
import { useTranslations } from 'next-intl';

export default function SystemAdminTenantsPage() {
    const t = useTranslations('SystemAdminTenants');
    const searchParams = useSearchParams();
    const [tenants, setTenants] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState(searchParams?.get('query') || '');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // New states for multi-step tenant status toggle
    const [tenantToConfirm, setTenantToConfirm] = useState<any | null>(null);
    const [deactivationReason, setDeactivationReason] = useState('');
    const [activeStep, setActiveStep] = useState<1 | 2>(1);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const refreshTenants = () => {
        setLoading(true);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
        fetchTenants(opts)
            .then(setTenants)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        refreshTenants();
    }, []);

    // Sync external URI changes onto local frame
    useEffect(() => {
        const query = searchParams?.get('query');
        if (query !== null && query !== undefined) {
            setSearchQuery(query);
        }
    }, [searchParams]);

    const handleActionClick = (tenant: any) => {
        setTenantToConfirm(tenant);
        setDeactivationReason('');
        setActiveStep(1);
    };

    const confirmToggleStatus = async () => {
        if (!tenantToConfirm) return;
        import('@/lib/api/school').then(async ({ updateTenantStatus }) => {
            setActionLoading(tenantToConfirm.id);
            const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };
            const nextStatus = tenantToConfirm.status === TenantStatus.ACTIVE ? TenantStatus.SUSPENDED : TenantStatus.ACTIVE;
            try {
                await updateTenantStatus(tenantToConfirm.id, nextStatus, opts, deactivationReason);
                await refreshTenants();
            } catch (e: any) {
                setError(e.message || 'Failed to update tenant status');
            } finally {
                setActionLoading(null);
                setTenantToConfirm(null);
                setDeactivationReason('');
                setActiveStep(1);
                setActiveDropdown(null);
            }
        });
    };

    const handleSmsToggle = async (tenantId: string) => {
        setActionLoading(`sms-${tenantId}`);
        const opts: RequestOpts = { token: authManager.getToken() || '', tenantId: authManager.getTenantId() || '' };

        // Find current status to rollback if error
        const targetTenant = tenants.find(t => t.id === tenantId);
        if (!targetTenant) return;
        const currentToggle = targetTenant.smsApproved;

        // Optimistic UI Update — instant visual feedback
        setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, smsApproved: !currentToggle } : t));

        try {
            await toggleTenantSms(tenantId, opts);
            // No silent refresh — optimistic state is the source of truth
        } catch (e: any) {
            // Rollback on fail
            setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, smsApproved: currentToggle } : t));
            setError(e.message || 'Failed to toggle SMS feature');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTenants = tenants.filter(t =>
        (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.slug?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (t.contactEmail?.toLowerCase() || '').includes(searchQuery.toLowerCase())
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
                            <Building2 className="w-6 h-6 text-indigo-600" />
                            {t('title')}
                        </h1>
                        <p className="text-slate-500 mt-1">{t('subtitle')}</p>
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('search')}
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

                {/* Confirmation Modal */}
                <AnimatePresence>
                    {tenantToConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                            >
                                <h3 className="text-xl font-bold text-slate-900 mb-2">
                                    {tenantToConfirm.status === TenantStatus.ACTIVE ? t('suspendConfirm') : t('reactivateConfirm')}
                                </h3>

                                {activeStep === 1 && (
                                    <>
                                        <p className="text-slate-500 text-sm mb-6">
                                            {tenantToConfirm.status === TenantStatus.ACTIVE ? t('areYouSureSuspend') : t('areYouSureReactivate')} <strong className="text-slate-700">{tenantToConfirm.name}</strong>
                                        </p>
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                onClick={() => setTenantToConfirm(null)}
                                                className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
                                            >
                                                {t('cancel')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (tenantToConfirm.status === TenantStatus.ACTIVE) {
                                                        setActiveStep(2);
                                                    } else {
                                                        confirmToggleStatus();
                                                    }
                                                }}
                                                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${tenantToConfirm.status === TenantStatus.ACTIVE ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                            >
                                                {tenantToConfirm.status === TenantStatus.ACTIVE ? t('confirmSuspend') : t('confirmReactivate')}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {activeStep === 2 && (
                                    <>
                                        <p className="text-slate-500 text-sm mb-4">
                                            {t('reasonLabel')}
                                        </p>
                                        <textarea
                                            rows={3}
                                            placeholder="Enter reason..."
                                            value={deactivationReason}
                                            onChange={(e) => setDeactivationReason(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 mb-6 resize-none"
                                        />
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                onClick={() => setActiveStep(1)}
                                                disabled={actionLoading === tenantToConfirm.id}
                                                className="px-4 py-2 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={confirmToggleStatus}
                                                disabled={actionLoading === tenantToConfirm.id}
                                                className="px-4 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                                            >
                                                {actionLoading === tenantToConfirm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                Confirm Suspension
                                            </button>
                                        </div>
                                    </>
                                )}
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
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <table className="w-full text-left border-collapse bg-white min-w-[800px]">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                <th className="px-6 py-4">{t('tenant')}</th>
                                <th className="px-6 py-4">{t('status')}</th>
                                <th className="px-6 py-4">{t('plan')}</th>
                                <th className="px-6 py-4">{t('type')}</th>
                                <th className="px-6 py-4 text-right">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!loading && filteredTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Building2 className="w-10 h-10 text-slate-300" />
                                            <p>{t('noTenants')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTenants.map((tnt, idx) => (
                                    <motion.tr
                                        key={tnt.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.02 } }}
                                        className="hover:bg-slate-50/60 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm border border-indigo-100 uppercase">
                                                    {tnt.slug?.substring(0, 2) || 'SC'}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 flex items-center gap-2 group-hover:text-indigo-700 transition-colors">
                                                        {tnt.name}
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-mono">
                                                            {tnt.slug}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-slate-500">{tnt.contactEmail}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${tnt.status === TenantStatus.ACTIVE ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    tnt.status === TenantStatus.PROVISIONING ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}>
                                                    {tnt.status === TenantStatus.ACTIVE ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                                                    {tnt.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold uppercase">
                                                {tnt.plan === 'PRO' ? <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> : null}
                                                {tnt.plan}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                                            {tnt.schoolType?.replace(/_/g, ' ') || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <button
                                                disabled={actionLoading === `sms-${tnt.id}`}
                                                onClick={() => handleSmsToggle(tnt.id)}
                                                className={`text-xs px-3 py-1.5 rounded-lg border transition-all shadow-sm flex items-center justify-center gap-1 min-w-[100px] ${tnt.smsApproved
                                                    ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                                    : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                                                    }`}
                                                title="Toggle Tenant SMS Rules System Wide"
                                            >
                                                {actionLoading === `sms-${tnt.id}` ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Smartphone className="w-3.5 h-3.5" />
                                                )}
                                                {tnt.smsApproved ? t('smsDisable') : t('smsEnable')}
                                            </button>

                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdown(activeDropdown === tnt.id ? null : tnt.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 bg-white ml-2"
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>

                                                <AnimatePresence>
                                                    {activeDropdown === tnt.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.95 }}
                                                                className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden flex flex-col"
                                                            >
                                                                <button onClick={() => { setActiveDropdown(null); handleActionClick(tnt); }} className={`px-4 py-3 text-sm text-left hover:bg-slate-50 font-medium ${tnt.status === TenantStatus.ACTIVE ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                    {tnt.status === TenantStatus.ACTIVE ? t('suspend') : t('reactivate')}
                                                                </button>
                                                            </motion.div>
                                                        </>
                                                    )}
                                                </AnimatePresence>
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
