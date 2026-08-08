'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Users, Settings, Activity, Building, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/v1/tenants/stats', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-tenant-id': localStorage.getItem('tenantId') || 'a1b2c3d4-0000-0000-0000-000000000001'
                    }
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

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-indigo-950 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                <div className="absolute bottom-0 left-10 w-40 h-40 bg-purple-500 rounded-full blur-3xl translate-y-1/2 opacity-20 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldCheck className="w-8 h-8 text-indigo-400" />
                            <h2 className="text-3xl font-bold tracking-tight">School Administration</h2>
                        </div>
                        <p className="text-indigo-200 max-w-lg mb-6">
                            Manage school policies, monitor system activity, and configure user access controls across the tenant ecosystem.
                        </p>
                        <div className="flex gap-4">
                            <Link href="/admin/users">
                                <button className="bg-white text-indigo-950 px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Manage Users
                                </button>
                            </Link>
                            <Link href="/admin/policy">
                                <button className="bg-indigo-900 border border-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-indigo-800 transition-colors flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    School Policies
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
                    <p className="text-slate-500 text-sm font-medium mb-1">Total Active Users</p>
                    <h4 className="text-3xl font-bold text-slate-800">
                        {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : stats?.users || 0}
                    </h4>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl mb-4 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <Building className="w-6 h-6" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Classes Enrolled</p>
                    <h4 className="text-3xl font-bold text-slate-800">
                        {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : stats?.classes || 0}
                    </h4>
                </motion.div>


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
                                <h4 className={`text-lg font-bold ${stats?.status === 'Healthy' ? 'text-emerald-600' : 'text-amber-600'}`}>{stats?.status || 'Active'}</h4>
                            </>
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
                        <Activity className="w-5 h-5 text-indigo-500" />
                        Admin Quick Actions
                    </h3>
                </div>
                <div className="divide-y divide-slate-100">
                    <Link href="/admin/users" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">User Directory</h4>
                                <p className="text-sm text-slate-500">View, add, disable, or modify school users and access.</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </Link>
                    <Link href="/admin/policy" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <Settings className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">School Policies</h4>
                                <p className="text-sm text-slate-500">Configure global academic settings, languages, and features.</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
