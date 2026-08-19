'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { apiClient } from '@/lib/api-client';
import { authManager } from '@/lib/auth-store';
import { useTranslations } from 'next-intl';

export default function ParentGradesPage() {
    const t = useTranslations('ParentGrades');
    const params = useParams();
    const studentId = params?.studentId as string;

    const [term, setTerm] = useState(1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [downloading, setDownloading] = useState(false);
    const [fetchingMarks, setFetchingMarks] = useState(false);

    const [marks, setMarks] = useState<any[]>([]);

    useEffect(() => {
        const fetchMarks = async () => {
            if (!studentId) return;
            setFetchingMarks(true);
            try {
                const marksData = await apiClient.get<any>(`/student-marks/student/${studentId}`);
                if (marksData) {
                    setMarks(marksData.filter((m: any) => m.term === term && m.academic_year === year));
                }
            } catch (e) {
                console.error(t('failedToLoad'), e);
            } finally {
                setFetchingMarks(false);
            }
        };
        fetchMarks();
    }, [studentId, term, year]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await fetch(`/api/v1/report-cards/student/${studentId}/term/${term}/year/${year}/download`, {
                credentials: 'include',
                headers: {
                    'X-Tenant-Id': authManager.getTenantId() || ''
                }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `report-card-${studentId}-term${term}-${year}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                alert(t('reportNotFound'));
            }
        } catch (e) {
            console.error(e);
            alert(t('failedToDownload'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <TutorialProvider role="PARENT" screenId="grades">
            <div className="max-w-5xl mx-auto space-y-6">
                <Link href="/parent" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-2">
                    <ArrowLeft className="w-4 h-4" />
                    {t('backToDashboard')}
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
                                <FileText className="w-6 h-6 text-indigo-600" />
                                {t('childReportCard')}
                            </h2>
                            <p className="text-slate-500 mt-1">{t('reviewProgress')}</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 md:p-6 border border-slate-200 mb-8 flex flex-col sm:flex-row gap-6">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('academicTerm')}</label>
                            <select
                                value={term}
                                onChange={e => setTerm(Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                            >
                                <option value={1}>{t('term1')}</option>
                                <option value={2}>{t('term2')}</option>
                                <option value={3}>{t('term3')}</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('academicYear')}</label>
                            <input
                                type="number"
                                value={year}
                                onChange={e => setYear(Number(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">{t('termResults')}</h3>

                        <div className="overflow-hidden border border-slate-200 rounded-t-xl rounded-b-lg">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                                        <th className="px-6 py-4">{t('subject')}</th>
                                        <th className="px-6 py-4">{t('score')}</th>
                                        <th className="px-6 py-4">{t('grade')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100">
                                    <AnimatePresence mode="wait">
                                        {fetchingMarks ? (
                                            <motion.tr key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                                <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                                                </td>
                                            </motion.tr>
                                        ) : marks.length === 0 ? (
                                            <motion.tr key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                                                    <div className="flex flex-col items-center">
                                                        <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
                                                        <p>{t('noMarksForChild')}</p>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ) : (
                                            marks.map((m: any, idx) => (
                                                <motion.tr
                                                    key={m.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                                                    className="hover:bg-slate-50 transition-colors group"
                                                >
                                                    <td className="px-6 py-4 font-medium text-slate-800">{m.subject}</td>
                                                    <td className="px-6 py-4 text-slate-600 font-medium">{m.marks}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                                        ${m.marks >= 75 ? 'bg-emerald-100 text-emerald-700' :
                                                                m.marks >= 65 ? 'bg-blue-100 text-blue-700' :
                                                                    m.marks >= 50 ? 'bg-indigo-100 text-indigo-700' :
                                                                        m.marks >= 35 ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-rose-100 text-rose-700'}`
                                                        }>
                                                            {m.marks >= 75 ? t('gradeA') :
                                                                m.marks >= 65 ? t('gradeB') :
                                                                    m.marks >= 50 ? t('gradeC') :
                                                                        m.marks >= 35 ? t('gradeS') : t('gradeW')}
                                                        </span>
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-slate-100">
                        <button
                            onClick={handleDownload}
                            disabled={downloading || marks.length === 0}
                            className={`w-full md:w-auto px-8 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all
                            ${marks.length === 0
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30'
                                }
                        `}
                        >
                            {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                            {downloading ? t('downloadingPdf') : t('downloadOfficial')}
                        </button>
                        {marks.length === 0 && (
                            <p className="text-xs text-center md:text-left text-slate-400 mt-3">{t('marksAvailableToGenerate')}</p>
                        )}
                    </div>
                </motion.div>
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
