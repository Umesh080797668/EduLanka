'use client';

import { motion } from 'framer-motion';
import { Users, FileEdit, ChevronRight, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function TeacherClassesPage() {
    // Mock classes data for the UI
    const classes = [
        { id: '1', name: 'Grade 10-A', subject: 'Mathematics', studentCount: 35 },
        { id: '2', name: 'Grade 10-B', subject: 'Mathematics', studentCount: 32 },
        { id: '3', name: 'Grade 11-A', subject: 'Science', studentCount: 40 },
    ];

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
            <div className="flex flex-col md:flex-row justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                        <Users className="w-6 h-6 text-indigo-600" />
                        My Assigned Classes
                    </h2>
                    <p className="text-slate-500 mt-1">Select a class to view the roster and enter student grades</p>
                </div>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {classes.map((cls) => (
                    <motion.div key={cls.id} variants={itemVariants} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all group">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{cls.name}</h3>
                            <p className="text-slate-500 font-medium text-sm mb-4">{cls.subject}</p>

                            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 py-2 px-3 rounded-lg border border-slate-100">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span>{cls.studentCount} Students Enrolled</span>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                            <Link href={`/teacher/classes/${cls.id}/grades`}>
                                <button className="w-full bg-white border border-indigo-200 text-indigo-600 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
                                    <FileEdit className="w-4 h-4" />
                                    Enter Grades
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </button>
                            </Link>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
