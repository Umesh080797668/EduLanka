'use client';

import { motion } from 'framer-motion';
import { Server, Activity, Loader2, BookOpenCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

export default function SystemAdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [tutorialStats, setTutorialStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const headers = {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'x-tenant-id': localStorage.getItem('tenantId') || 'a1b2c3d4-0000-0000-0000-000000000001'
                };

                const [res, tutRes] = await Promise.all([
                    fetch('/api/v1/tenants/stats', { headers }),
                    fetch('/api/v1/system-admin/tutorials/stats', { headers })
                ]);

                if (res.ok) {
                    const json = await res.json();
                    setStats(json.data);
                }
                if (tutRes.ok) {
                    const json = await tutRes.json();
                    setTutorialStats(json.data);
                }
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

    return (
        <TutorialProvider role="SUPER_ADMIN" screenId="dashboard">
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
                                <h2 className="text-3xl font-bold tracking-tight">System Administration</h2>
                            </div>
                            <p className="text-slate-300 max-w-lg mb-6">
                                Global oversight of platform health across all tenants.
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
                        <p className="text-slate-500 text-sm font-medium mb-1">System Status</p>
                        <div className="flex items-center gap-2">
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                            ) : (
                                <>
                                    <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${stats?.status === 'Healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                    <h4 className={`text-lg font-bold ${stats?.status === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>{stats?.status === 'Healthy' ? 'Healthy' : 'Active'}</h4>
                                </>
                            )}
                        </div>
                    </motion.div>

                    {/* Tutorial Stats Card */}
                    {tutorialStats && Object.keys(tutorialStats).length > 0 && (
                        <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                            <div className="w-12 h-12 bg-orange-50 rounded-xl mb-4 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                                <BookOpenCheck className="w-6 h-6" />
                            </div>
                            <p className="text-slate-500 text-sm font-medium mb-1">Overall Tutorial Completions</p>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold text-slate-800">
                                        {Object.values(tutorialStats).reduce((sum: number, s: any) => sum + s.completed, 0) as number}
                                    </span>
                                    <span className="text-xs text-slate-400">Completed</span>
                                </div>
                                <div className="w-px h-8 bg-slate-200"></div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold text-slate-800">
                                        {Object.values(tutorialStats).reduce((sum: number, s: any) => sum + s.skipped, 0) as number}
                                    </span>
                                    <span className="text-xs text-slate-400">Skipped</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
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
                            System Health Overview
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 p-4">
                        <p className="text-slate-500">Review overall platform health and metrics.</p>
                    </div>
                </motion.div>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
