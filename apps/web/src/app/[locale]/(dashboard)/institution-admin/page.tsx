'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Users, Settings, Activity, Building, ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { DashboardCardsSkeleton } from '@/components/ui/Skeleton';
import { useTranslations } from 'next-intl';

export default function InstitutionAdminDashboard() {
    const t = useTranslations('InstitutionAdminDashboard');
    const [stats, setStats] = useState<any>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const headers = {
                    
                    
                };

                const res = await fetch('/api/v1/tenants/stats', {
                    credentials: 'include',
                    headers,
                    cache: 'no-store'
                });

                if (res.ok) {
                    const json = await res.json();
                    setStats(json.data);
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

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                <DashboardCardsSkeleton />
            </div>
        );
    }

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="dashboard">
            <div className="max-w-6xl mx-auto space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-950 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
                    id="nav-dashboard"
                >
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl translate-y-1/2 opacity-20 pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <ShieldCheck className="w-8 h-8 text-indigo-400" />
                                <h2 className="text-3xl font-bold tracking-tight">{t('schoolAdmin')}</h2>
                            </div>
                            <p className="text-indigo-200 max-w-lg mb-6">
                                {t('dashboardSubtitle')}
                            </p>
                            <div className="flex gap-4">
                                <Link href="/institution-admin/students" id="nav-users">
                                    <button className="bg-white text-indigo-950 px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        {t('manageUsers')}
                                    </button>
                                </Link>
                                <Link href="/institution-admin/policy" id="nav-policies">
                                    <button className="bg-indigo-900 border border-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-800 transition-colors flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        {t('schoolPolicies')}
                                    </button>
                                </Link>
                            </div>
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
                        <div className="w-12 h-12 bg-blue-50 rounded-xl mb-4 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium mb-1">{t('totalActiveUsers')}</p>
                        <h4 className="text-3xl font-bold text-slate-800">
                            {stats?.users || 0}
                        </h4>
                    </motion.div>

                    <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl mb-4 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <Building className="w-6 h-6" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium mb-1">{t('classesEnrolled')}</p>
                        <h4 className="text-3xl font-bold text-slate-800">
                            {stats?.classes || 0}
                        </h4>
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
                            <Activity className="w-5 h-5 text-indigo-500" />
                            {t('institutionAdministration')}
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        <Link href="/institution-admin/students" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{t('userDirectory')}</h4>
                                    <p className="text-sm text-slate-500">{t('userDirectoryDesc')}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </Link>
                        <Link href="/institution-admin/policy" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{t('schoolPoliciesTitle')}</h4>
                                    <p className="text-sm text-slate-500">{t('schoolPoliciesDesc')}</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </Link>
                    </div>
                </motion.div>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
