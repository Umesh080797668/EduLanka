'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Calendar, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import NoticeFeed from '@/components/notices/NoticeFeed';
import { Badge } from '@/components/ui/Badge';
import { buttonClass } from '@/components/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';

interface StudentInfo {
    name: string;
    className: string;
    admission: string;
}

export default function StudentDashboard() {
    const t = useTranslations('StudentDashboard');
    const tn = useTranslations('Notices');
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                const data = await apiClient.get<any>('/students/me');
                setStudentInfo({
                    name: data?.users?.full_name || '',
                    className: data?.classes
                        ? `${data.classes.grade}-${data.classes.name}`
                        : '',
                    admission: data?.admission_no || '',
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
                {/* ── Hero ──────────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative isolate overflow-hidden rounded-card bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-card sm:p-8"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-white/10 blur-3xl"
                    />

                    <div className="relative">
                        <h1 className="text-display-sm text-white">
                            {t('welcomeBack')} {studentInfo?.name || '…'}
                        </h1>

                        {studentInfo?.className || studentInfo?.admission ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                {studentInfo.className && (
                                    <Badge
                                        variant="soft"
                                        size="md"
                                        className="bg-white/15 text-white"
                                    >
                                        {t('classLabel')}: {studentInfo.className}
                                    </Badge>
                                )}
                                {studentInfo.admission && (
                                    <Badge
                                        variant="soft"
                                        size="md"
                                        className="bg-white/15 text-white"
                                    >
                                        {t('admissionLabel')}: {studentInfo.admission}
                                    </Badge>
                                )}
                            </div>
                        ) : (
                            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80">
                                {t('dashboardSubtitle')}
                            </p>
                        )}

                        <Link
                            href="/student/grades"
                            className={buttonClass({
                                size: 'md',
                                className:
                                    'mt-6 bg-white text-brand-700 shadow-sm hover:bg-white/90',
                            })}
                        >
                            <FileText className="size-4" />
                            {t('viewFullReport')}
                        </Link>
                    </div>
                </motion.section>

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* ── Quick links ───────────────────────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    >
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle>{t('quickLinks')}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3">
                                <Link
                                    id="nav-grades"
                                    href="/student/grades"
                                    className="group flex flex-col items-center justify-center gap-3 rounded-card border border-border bg-muted/50 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                    <span className="grid size-11 place-items-center rounded-full bg-card text-primary shadow-xs transition-transform group-hover:scale-105">
                                        <FileText className="size-5" />
                                    </span>
                                    <span className="text-[13px] font-semibold text-foreground">
                                        {t('reportCards')}
                                    </span>
                                </Link>

                                <div
                                    aria-disabled
                                    className="relative flex cursor-not-allowed flex-col items-center justify-center gap-3 overflow-hidden rounded-card border border-border bg-muted/40 px-4 py-6 text-center opacity-75"
                                >
                                    <Badge className="absolute right-2 top-2">
                                        {t('comingPhase6')}
                                    </Badge>
                                    <span className="grid size-11 place-items-center rounded-full bg-card text-muted-foreground shadow-xs">
                                        <Calendar className="size-5" />
                                    </span>
                                    <span className="text-[13px] font-semibold text-muted-foreground">
                                        {t('timetable')}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* ── Notices ───────────────────────────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.18 }}
                    >
                        <Card className="flex h-full flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="size-4 text-muted-foreground" />
                                    {tn('officialNotices')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[420px] flex-1 overflow-y-auto">
                                <NoticeFeed />
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
