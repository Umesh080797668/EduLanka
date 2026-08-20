'use client';

import { motion } from 'framer-motion';
import { Server, Activity, BookOpenCheck, RadioTower, Send, Users, Network } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeTelemetry } from '@/hooks/useRealtimeTelemetry';
import { useEffect, useState } from 'react';
import { DashboardCardsSkeleton } from '@/components/ui/Skeleton';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from 'next-intl';

export default function SystemAdminDashboard() {
    const t = useTranslations('SystemAdminDashboard');
    const { activeUsers } = useRealtimeTelemetry();
    const [stats, setStats] = useState<any>(null);
    const [tutorialStats, setTutorialStats] = useState<any>(null);
    const [observabilityStats, setObservabilityStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [res, tutRes, obsRes] = await Promise.all([
                    apiClient.get<any>('/tenants/stats'),
                    apiClient.get<any>('/system-admin/tutorials/stats'),
                    apiClient.get<any>('/system-admin/observability/metrics').catch(() => null)
                ]);

                setStats(res);
                setTutorialStats(tutRes);
                setObservabilityStats(obsRes);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                <DashboardCardsSkeleton />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
                id="nav-dashboard"
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-slate-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Server className="w-8 h-8 text-slate-400" />
                            <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
                        </div>
                        <p className="text-slate-300 max-w-lg mb-6">
                            {t('subtitle')}
                        </p>
                    </div>
                </div>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl mb-4 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                        <Activity className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">{t('systemStatus')}</p>
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${stats?.status === 'Healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        <h4 className={`text-lg font-bold ${stats?.status === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>{stats?.status === 'Healthy' ? t('healthy') : t('active')}</h4>
                    </div>
                </motion.div>

                {/* Tutorial Stats Card */}
                {tutorialStats && Object.keys(tutorialStats).length > 0 && (
                    <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-orange-50 rounded-xl mb-4 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                            <BookOpenCheck className="w-6 h-6" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium mb-1">{t('overallCompletions')}</p>
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold text-slate-800">
                                    {Object.values(tutorialStats).reduce((sum: number, s: any) => sum + s.completed, 0) as number}
                                </span>
                                <span className="text-xs text-slate-400">{t('completed')}</span>
                            </div>
                            <div className="w-px h-8 bg-slate-200"></div>
                            <div className="flex flex-col">
                                <span className="text-2xl font-bold text-slate-800">
                                    {Object.values(tutorialStats).reduce((sum: number, s: any) => sum + s.skipped, 0) as number}
                                </span>
                                <span className="text-xs text-slate-400">{t('skipped')}</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Supabase Presence Telemetry */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl mb-4 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Supabase Realtime (Presence)</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-blue-500"></div>
                        <h4 className="text-2xl font-bold text-slate-800">{activeUsers} <span className="text-sm font-normal text-slate-400">active instances</span></h4>
                    </div>
                </motion.div>

                {/* NestJS Socket.IO Telemetry */}
                <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-green-50 rounded-xl mb-4 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                        <Network className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">NestJS WebSockets (Redis Adapter)</p>
                    <div className="flex items-center gap-2">
                        {observabilityStats ? (
                            <>
                                <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-green-500"></div>
                                <h4 className="text-2xl font-bold text-slate-800">{observabilityStats.websockets?.active_connections || 0} <span className="text-sm font-normal text-slate-400">connected sockets</span></h4>
                            </>
                        ) : (
                            <h4 className="text-lg font-bold text-slate-300">Offline</h4>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
            >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-slate-500" />
                        {t('healthOverview')}
                    </h3>
                </div>
                <div className="divide-y divide-slate-100 p-4">
                    <p className="text-slate-500">{t('healthDesc')}</p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6"
            >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <BookOpenCheck className="w-5 h-5 text-orange-500" />
                        {t('adoptionAnalytics')}
                    </h3>
                </div>
                <div className="p-6">
                    {!tutorialStats || Object.keys(tutorialStats).length === 0 ? (
                        <div className="text-center text-slate-500 py-4">{t('noData')}</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="text-sm text-slate-500 italic max-w-sm mb-4">
                                {t('analyticsMoved')}
                            </div>
                            {Object.values(tutorialStats).map((tut: any, idx: number) => {
                                const completionPercentage = tut.eligible > 0 ? Math.round((tut.completed / tut.eligible) * 100) : 0;
                                return (
                                    <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-800 capitalize leading-tight">{tut.role?.toLowerCase().replace('_', ' ') || t('global')}</h4>
                                            </div>
                                            <span className="text-sm font-black text-orange-700 bg-orange-100 px-2 py-1 rounded-md">{completionPercentage}%</span>
                                        </div>

                                        <div className="w-full bg-slate-200 rounded-full h-2.5 mb-3">
                                            <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${completionPercentage}%` }}></div>
                                        </div>

                                        <div className="flex justify-between text-xs font-semibold">
                                            <span className="text-orange-600">{tut.completed} {t('completedLower')}</span>
                                            <span className="text-slate-500 text-[10px]">{tut.eligible} {t('eligibleLower')}</span>
                                            <span className="text-slate-400">{tut.skipped} {t('skippedLower')}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6"
            >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-blue-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <RadioTower className="w-5 h-5 text-blue-600" />
                        Global Maintenance Broadcast
                    </h3>
                </div>
                <div className="p-6">
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const title = formData.get('title') as string;
                            const content = formData.get('content') as string;
                            const send_sms = formData.get('send_sms') === 'on';

                            try {
                                setLoading(true);
                                const res = await apiClient.post<any>('/notices/broadcast', { title, content, send_sms });
                                toast.success(`Broadcast Dispatched Successfully!`, { description: `Successfully injected notices redundantly into ${res.dispatches} active Tenants universally.` });
                                (e.target as HTMLFormElement).reset();
                            } catch (err: any) {
                                toast.error('Global Broadcast Failure', { description: err.message });
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="space-y-4 max-w-2xl"
                    >
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Alert Title</label>
                            <input
                                name="title"
                                required
                                placeholder="e.g. Scheduled Infrastructure Maintenance"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Message Content</label>
                            <textarea
                                name="content"
                                required
                                rows={4}
                                placeholder="Provide comprehensive operational details spanning all tenants..."
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                            ></textarea>
                        </div>
                        <div className="flex items-center gap-2 mt-4 mb-2 p-3 bg-red-50 rounded-lg border border-red-100">
                            <input type="checkbox" id="send_sms" name="send_sms" className="rounded text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer" />
                            <label htmlFor="send_sms" className="text-sm font-semibold text-red-800 cursor-pointer select-none">
                                Disaster Override: Echo broadcast to offline users natively via Twilio Gateway (Bypasses active Quotas blockades unconditionally)
                            </label>
                        </div>
                        <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50">
                            <Send className="w-4 h-4" />
                            Dispatch Universal Broadcast
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
