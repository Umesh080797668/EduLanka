'use client';

import { motion } from 'framer-motion';
import { BookOpen, Users, LogIn, LineChart, FileEdit } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function TeacherDashboard() {
    const [teacherName, setTeacherName] = useState('Loading...');

    useEffect(() => {
        const init = async () => {
            try {
                // In a real scenario, this fetches /teachers/me
                const res = await fetch('/api/v1/users/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-tenant-id': localStorage.getItem('tenantId') || ''
                    }
                });
                if (res.ok) {
                    const json = await res.json();
                    setTeacherName(json.data?.full_name || 'Teacher');
                } else {
                    setTeacherName('Teacher');
                }
            } catch (e) {
                setTeacherName('Teacher');
            }
        };
        init();
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
        <div className="max-w-5xl mx-auto space-y-6">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-sky-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-30 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2">Good morning, {teacherName}</h2>
                        <p className="text-sky-200 max-w-lg mb-4">
                            You have 3 classes today. Grade entry for Term 1 is currently open.
                        </p>
                        <div className="flex gap-4">
                            <Link href="/teacher/classes">
                                <button className="bg-white text-sky-800 px-5 py-2.5 rounded-lg font-semibold hover:bg-sky-50 transition-colors shadow-sm flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    View assigned classes
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
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
                <motion.div variants={itemVariants} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl mb-4 flex items-center justify-center text-indigo-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Total Students</p>
                    <h4 className="text-2xl font-bold text-slate-800">142</h4>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl mb-4 flex items-center justify-center text-emerald-600">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Active Classes</p>
                    <h4 className="text-2xl font-bold text-slate-800">4</h4>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-rose-50 rounded-xl mb-4 flex items-center justify-center text-rose-600">
                        <FileEdit className="w-5 h-5" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Grading Progress</p>
                    <h4 className="text-2xl font-bold text-slate-800">75%</h4>
                </motion.div>

                <motion.div variants={itemVariants} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl mb-4 flex items-center justify-center text-amber-600">
                        <LogIn className="w-5 h-5" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Attendance Today</p>
                    <h4 className="text-2xl font-bold text-slate-800">92%</h4>
                </motion.div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-500" />
                            My Schedule Today
                        </h3>
                    </div>

                    <div className="space-y-4">
                        {[
                            { time: '08:00 AM - 08:40 AM', class: 'Grade 10-A', subject: 'Mathematics' },
                            { time: '09:20 AM - 10:00 AM', class: 'Grade 11-B', subject: 'Physics' },
                            { time: '11:00 AM - 11:40 AM', class: 'Grade 10-C', subject: 'Mathematics' }
                        ].map((sch, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-slate-50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800">{sch.subject}</span>
                                    <span className="text-sm text-slate-500">{sch.time}</span>
                                </div>
                                <span className="mt-2 sm:mt-0 font-medium text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
                                    {sch.class}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            <LineChart className="w-5 h-5 text-emerald-500" />
                            Quick Actions
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Link href="/teacher/classes" className="bg-slate-50 p-6 rounded-xl flex flex-col items-center text-center hover:bg-slate-100 transition-colors border border-slate-100 group">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                <FileEdit className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-slate-700">Enter Grades</span>
                        </Link>

                        <div className="bg-slate-50 p-6 rounded-xl flex flex-col items-center text-center opacity-70 cursor-not-allowed border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-2 right-2 bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Term 2</div>
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-600 mb-3 shadow-sm grayscale">
                                <LogIn className="w-6 h-6" />
                            </div>
                            <span className="font-semibold text-slate-500">Take Attendance</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
