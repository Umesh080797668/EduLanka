'use client';

import { motion } from 'framer-motion';
import { BookOpen, Calendar, Clock, Trophy, FileText, Activity } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StudentDashboard() {
    const [studentName, setStudentName] = useState('Loading...');

    useEffect(() => {
        const init = async () => {
            try {
                const res = await fetch('/api/v1/students/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-tenant-id': localStorage.getItem('tenantId') || 'DEMO'
                    }
                });
                if (res.ok) {
                    const json = await res.json();
                    setStudentName(json.data.users?.full_name || 'Student');
                } else {
                    setStudentName('Student');
                }
            } catch (e) {
                setStudentName('Student');
            }
        };
        init();
    }, []);

    // Mock data for UI presentation
    const recentActivity = [
        { title: 'Mathematics Homework', time: '2 hours ago', icon: BookOpen, color: 'text-indigo-500', bg: 'bg-indigo-100' },
        { title: 'Science Lab Report Graded', time: 'Yesterday', icon: Trophy, color: 'text-emerald-500', bg: 'bg-emerald-100' },
        { title: 'Upcoming History Test', time: 'In 3 days', icon: Calendar, color: 'text-rose-500', bg: 'bg-rose-100' },
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants: any = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.3 } }
    };

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {studentName}! 🎓</h2>
                    <p className="text-indigo-100 max-w-lg mb-6">
                        You have 2 upcoming assignments this week. Your attendance rate is looking great at 96% for the current term!
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Link href="/student/grades">
                            <button className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                View Full Report
                            </button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
                {/* Stats Cards */}
                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-600">
                        <Activity className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Current GPA</p>
                        <h3 className="text-2xl font-bold text-slate-800">3.8</h3>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                        <Clock className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Attendance</p>
                        <h3 className="text-2xl font-bold text-slate-800">96.5%</h3>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600">
                        <BookOpen className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">Assignments Done</p>
                        <h3 className="text-2xl font-bold text-slate-800">12 / 15</h3>
                    </div>
                </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: 0.3 } }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
                        <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View All</button>
                    </div>

                    <div className="space-y-6">
                        {recentActivity.map((item, idx) => (
                            <div key={idx} className="flex gap-4 group">
                                <div className="relative pt-1">
                                    <div className={`w-10 h-10 rounded-full ${item.bg} ${item.color} flex items-center justify-center shrink-0`}>
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    {idx !== recentActivity.length - 1 && (
                                        <div className="absolute top-11 left-1/2 -translate-x-1/2 w-0.5 h-full bg-slate-100 group-hover:bg-slate-200 transition-colors"></div>
                                    )}
                                </div>
                                <div className="pt-2 pb-4">
                                    <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: 0.4 } }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Quick Links</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 flex-1">
                        <Link href="/student/grades" className="bg-slate-50 hover:bg-slate-100 rounded-xl p-5 border border-slate-100 transition-colors group flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <FileText className="w-6 h-6 text-indigo-600" />
                            </div>
                            <span className="font-semibold text-slate-700 text-sm">Report Cards</span>
                        </Link>

                        <div className="bg-slate-50 opacity-70 cursor-not-allowed rounded-xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                            <div className="absolute top-2 right-2 bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Coming Phase 6</div>
                            <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 grayscale">
                                <Calendar className="w-6 h-6 text-slate-400" />
                            </div>
                            <span className="font-semibold text-slate-500 text-sm">Timetable</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
