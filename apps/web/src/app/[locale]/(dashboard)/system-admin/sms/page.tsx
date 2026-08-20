'use client';

import { motion } from 'framer-motion';
import { MessageSquare, AlertTriangle, Server, BarChart3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { DashboardCardsSkeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

export default function SmsGatewayAdminPage() {
    const [quotas, setQuotas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQuotas = async () => {
            try {
                const data = await apiClient.get<any[]>('/sms/quotas');
                setQuotas(data);
            } catch (e: any) {
                toast.error('Failed to load Twilio Matrices', { description: e?.message });
            } finally {
                setLoading(false);
            }
        };
        fetchQuotas();
    }, []);

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                <DashboardCardsSkeleton />
            </div>
        );
    }

    const totalDispatched = quotas.reduce((acc, q) => acc + q.current_month_usage, 0);
    const totalFailed = quotas.reduce((acc, q) => acc + q.failed_deliveries, 0);
    const totalOverage = quotas.reduce((acc, q) => acc + q.overage_count, 0);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-950 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Server className="w-8 h-8 text-blue-400" />
                            <h2 className="text-3xl font-bold tracking-tight">Twilio SMS Interconnect</h2>
                        </div>
                        <p className="text-indigo-200 max-w-lg mb-6">
                            Monitor aggregate transactional messaging throughput natively across the entire infrastructure footprint.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Platform Rollups */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl mb-4 flex items-center justify-center text-blue-600">
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Total Global Dispatches</p>
                    <h4 className="text-3xl font-bold text-slate-800">{totalDispatched}</h4>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl mb-4 flex items-center justify-center text-emerald-600">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Global Overages (Billable)</p>
                    <h4 className="text-3xl font-bold text-emerald-600">{totalOverage}</h4>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-red-50 rounded-xl mb-4 flex items-center justify-center text-red-600">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Failed Transmissions</p>
                    <h4 className="text-3xl font-bold text-red-600">{totalFailed}</h4>
                </div>
            </div>

            {/* Tenant Granularity */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Tenant Usage Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Tenant Name</th>
                                <th className="px-6 py-4 font-semibold">Subscription Rank</th>
                                <th className="px-6 py-4 font-semibold">Allocated Quota</th>
                                <th className="px-6 py-4 font-semibold">Consumed Usage</th>
                                <th className="px-6 py-4 font-semibold text-right">Overage Surcharge</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {quotas.map((tenant) => {
                                const ratio = tenant.monthly_quota > 0
                                    ? (tenant.current_month_usage / tenant.monthly_quota) * 100
                                    : tenant.current_month_usage > 0 ? 100 : 0;

                                const isOverage = tenant.overage_count > 0;

                                return (
                                    <tr key={tenant.tenant_id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-slate-800">
                                            {tenant.tenant_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold">
                                                {tenant.plan}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {tenant.plan === 'COMMUNITY' ? 'N/A' : (tenant.monthly_quota || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 w-1/4">
                                            <div className="flex items-center gap-3">
                                                <span className={`font-semibold ${isOverage ? 'text-orange-600' : 'text-slate-700'}`}>
                                                    {tenant.current_month_usage.toLocaleString()}
                                                </span>
                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${isOverage ? 'bg-orange-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(ratio, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isOverage ? (
                                                <span className="text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full text-sm">
                                                    +{tenant.overage_count.toLocaleString()} SMS
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 font-medium">None</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {quotas.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        No active tenants consuming platform messaging limits natively found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
