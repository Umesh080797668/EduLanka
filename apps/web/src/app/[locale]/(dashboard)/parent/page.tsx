'use client';

import { motion } from 'framer-motion';
import { Users, GraduationCap, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { useTranslations } from 'next-intl';

export default function ParentDashboard() {
    const t = useTranslations('ParentDashboard');
    const [parentName, setParentName] = useState('...');
    const [childrenData, setChildrenData] = useState<any[]>([]);

    // Mock data for UI presentation when API lacks children
    const FALLBACK_CHILDREN = [
        { id: 'STU-1001', name: 'Nisal Perera', grade: 'Grade 10-A', gpa: '3.8', attendance: '96%' },
        { id: 'STU-2055', name: 'Kamal Perera', grade: 'Grade 7-C', gpa: '3.4', attendance: '92%' }
    ];

    useEffect(() => {
        const init = async () => {
            try {
                // In a real scenario, this would fetch /parents/me and their linked children
                const res = await fetch('/api/v1/parents/me', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'x-tenant-id': localStorage.getItem('tenantId') || ''
                    }
                });
                if (res.ok) {
                    const json = await res.json();
                    setParentName(json.data.users?.full_name || 'Parent');
                    if (json.data.children && json.data.children.length > 0) {
                        setChildrenData(json.data.children);
                    } else {
                        setChildrenData(FALLBACK_CHILDREN);
                    }
                } else {
                    setParentName('Parent');
                    setChildrenData(FALLBACK_CHILDREN);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setParentName('Parent');
                setChildrenData(FALLBACK_CHILDREN);
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
        show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.3 } }
    };

    return (
        <TutorialProvider role="PARENT" screenId="dashboard">
            <div className="max-w-5xl mx-auto space-y-6" id="nav-dashboard">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-900 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight mb-2">{t('greeting')} {parentName}</h1>
                            <p className="text-indigo-200 max-w-lg">
                                {t('dashboardSubtitle')}
                            </p>
                        </div>
                        <div className="hidden md:flex w-16 h-16 bg-white/10 rounded-2xl items-center justify-center backdrop-blur-sm border border-white/20">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                    </div>
                </motion.div>

                <h3 className="text-xl font-bold text-slate-800 pt-4 px-1">{t('linkedChildren')}</h3>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                    {childrenData.map((child, idx) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all hover:border-indigo-100 group"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                        <GraduationCap className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{child.name}</h4>
                                        <p className="text-sm font-medium text-slate-500">{child.grade || t('gradeNotAssigned')}</p>
                                    </div>
                                </div>
                            </div>



                            <Link id={`nav-child-${idx}`} href={`/parent/students/${child.id}/grades`}>
                                <button className="w-full bg-slate-50 hover:bg-indigo-50 text-indigo-600 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-100 hover:border-indigo-100">
                                    {t('viewAcademicReport')}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </Link>
                        </motion.div>
                    ))}
                </motion.div>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
