'use client';

import { motion } from 'framer-motion';
import { Shield, Clock, Search, Server, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { authManager } from '@/lib/auth-store';
import { useTranslations } from 'next-intl';

export default function AuditLogsPage() {
    const t = useTranslations('SystemAdminAuditLogs');
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 20;

    useEffect(() => {
        let isMounted = true;
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/v1/audit-logs?limit=${limit}&offset=${(page - 1) * limit}`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Tenant-Id': authManager.getTenantId() || ''
                    },
                    credentials: 'include'
                });
                if (res.ok) {
                    const json = await res.json();
                    if (isMounted) {
                        setLogs(json.data?.data || []);
                        setTotal(json.data?.total || 0);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch audit logs", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchLogs();
        return () => { isMounted = false; };
    }, [page]);

    const getActionColor = (action: string) => {
        if (action.includes('PROVISION') || action.includes('CREATE')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (action.includes('DELETE') || action.includes('DISABLE')) return 'bg-red-100 text-red-700 border-red-200';
        if (action.includes('UPDATE') || action.includes('CHANGE')) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-blue-100 text-blue-700 border-blue-200';
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-20 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-8 h-8 text-indigo-400" />
                            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
                        </div>
                        <p className="text-slate-300 max-w-lg">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
            >
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('filterPlaceholder')}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            disabled
                        />
                    </div>
                    <div className="text-sm font-medium text-slate-500">
                        {t('totalRecords')} <span className="text-slate-900 font-bold">{total}</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">{t('colAction')}</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">{t('colTarget')}</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">{t('colActor')}</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">{t('colIp')}</th>
                                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">{t('colTime')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && logs.length === 0 ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="py-4 px-6"><div className="h-6 w-32 bg-slate-200 rounded-md"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 w-40 bg-slate-200 rounded-md"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 w-24 bg-slate-200 rounded-md"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 w-32 bg-slate-200 rounded-md"></div></td>
                                        <td className="py-4 px-6"><div className="h-4 w-32 bg-slate-200 rounded-md"></div></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <AlertCircle className="w-8 h-8 text-slate-300" />
                                            <span>{t('noLogs')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6 align-top">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getActionColor(log.action)}`}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            <div className="text-sm font-semibold text-slate-800">{log.entity_type}</div>
                                            <div className="text-xs font-mono text-slate-500">{log.entity_id}</div>
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            <div className="text-sm font-semibold text-slate-800">{log.actor_role}</div>
                                            <div className="text-xs text-slate-500 truncate w-32" title={log.actor_id}>{log.actor_id}</div>
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            <div className="flex items-center gap-1 text-sm font-mono text-slate-600">
                                                <Server className="w-3.5 h-3.5 text-slate-400" />
                                                {log.ip_address || 'UNKNOWN'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 align-top">
                                            <div className="flex items-center gap-1 text-sm text-slate-600">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                        {t('previous')}
                    </button>
                    <span className="text-sm text-slate-600 font-medium">{t('page')} {page} {t('of')} {Math.max(1, Math.ceil(total / limit))}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={page * limit >= total || loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {t('next')}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
