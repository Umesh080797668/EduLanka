'use client';

import { motion } from 'framer-motion';
import { Calendar, FileText } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from 'next-intl';

export default function StudentDashboard() {
    const t = useTranslations('StudentDashboard');
    const [studentInfo, setStudentInfo] = useState<{ name: string, className: string, admission: string } | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const data = await apiClient.get<any>('/students/me');
                setStudentInfo({
                    name: data?.users?.full_name || 'Student',
                    className: data?.classes ? `${data.classes.grade}-${data.classes.name}` : 'Unassigned',
                    admission: data?.admission_no || ''
                });
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, []);

    return (
        <TutorialProvider role="STUDENT" screenId="dashboard">
            <div className="space-y-6" id="nav-dashboard">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-8 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold tracking-tight mb-2">{t('welcomeBack')} {studentInfo?.name || '...'}{t('greetingEmoji')}</h2>
                        <p className="text-indigo-100 max-w-lg mb-6">
                            {studentInfo ? `Class: ${studentInfo.className} | Admission No: ${studentInfo.admission}` : t('dashboardSubtitle')}
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <Link href="/student/grades">
                                <button className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    {t('viewFullReport')}
                                </button>
                            </Link>
                        </div>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0, transition: { delay: 0.3 } }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-800">{t('quickLinks')}</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 flex-1">
                            <Link id="nav-grades" href="/student/grades" className="bg-slate-50 hover:bg-slate-100 rounded-xl p-5 border border-slate-100 transition-colors group flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6 text-indigo-600" />
                                </div>
                                <span className="font-semibold text-slate-700 text-sm">{t('reportCards')}</span>
                            </Link>

                            <div className="bg-slate-50 opacity-70 cursor-not-allowed rounded-xl p-5 border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                                <div className="absolute top-2 right-2 bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{t('comingPhase6')}</div>
                                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3 grayscale">
                                    <Calendar className="w-6 h-6 text-slate-400" />
                                </div>
                                <span className="font-semibold text-slate-500 text-sm">{t('timetable')}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
