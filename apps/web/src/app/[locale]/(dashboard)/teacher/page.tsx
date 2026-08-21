'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BookOpen, FileEdit, Users, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import NoticeFeed from '@/components/notices/NoticeFeed';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Progress, StatCard } from '@/components/ui/Stat';

/** Sri Lankan school calendar: three terms across the year. */
function currentTermFor(month: number) {
    if (month >= 1 && month <= 4) return 1;
    if (month >= 5 && month <= 8) return 2;
    return 3;
}

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function TeacherDashboard() {
    const t = useTranslations('TeacherDashboard');
    const tn = useTranslations('Notices');
    const currentTerm = currentTermFor(new Date().getMonth() + 1);

    const [teacherName, setTeacherName] = useState('…');
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeClasses: 0,
        gradingProgress: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            try {
                const user = await apiClient.get<any>('/users/me');
                setTeacherName(user?.full_name || 'Teacher');

                if (user?.id) {
                    const classesData = await apiClient.get<any[]>(
                        `/classes?teacherId=${user.id}`,
                    );
                    if (classesData) {
                        let students = 0;
                        classesData.forEach((c) => {
                            students += c.students?.length || 0;
                        });

                        // Grading progress = marks recorded this term / enrolled students.
                        const marksPromises = classesData.map(async (c) => {
                            try {
                                return await apiClient.get<any[]>(
                                    `/student-marks/class/${c.id}?term=${currentTerm}`,
                                );
                            } catch {
                                return [];
                            }
                        });
                        const results = await Promise.all(marksPromises);

                        let totalMarksCount = 0;
                        results.forEach((mList) => {
                            if (mList) totalMarksCount += mList.length;
                        });

                        const progress =
                            students > 0
                                ? Math.round((totalMarksCount / students) * 100)
                                : 0;
                        setStats({
                            totalStudents: students,
                            activeClasses: classesData.length,
                            gradingProgress: progress,
                        });
                    }
                }
            } catch (e) {
                console.error(e);
                setTeacherName('Teacher');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [currentTerm]);

    return (
        <TutorialProvider role="TEACHER" screenId="dashboard">
            <div className="mx-auto max-w-5xl space-y-6" id="nav-dashboard">
                {/* ── Hero ──────────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative isolate overflow-hidden rounded-card bg-gradient-to-br from-info to-brand-800 p-6 text-white shadow-card sm:p-8"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-white/10 blur-3xl"
                    />
                    <div className="relative">
                        <h1 className="text-display-sm text-white">
                            {t('greeting')} {teacherName}
                        </h1>
                        <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80">
                            {t('dashboardSubtitle', {
                                count: stats.activeClasses,
                                term: t(`term${currentTerm}`),
                            })}
                        </p>
                        <Link
                            id="nav-classes"
                            href="/teacher/classes"
                            className="mt-6 inline-flex h-10 items-center gap-2 rounded-input bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            <BookOpen className="size-4" />
                            {t('viewAssignedClasses')}
                        </Link>
                    </div>
                </motion.section>

                {/* ── Stats ─────────────────────────────────────────────────── */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label={t('totalStudents')}
                            value={stats.totalStudents}
                            icon={<Users />}
                            tone="primary"
                            loading={loading}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label={t('activeClasses')}
                            value={stats.activeClasses}
                            icon={<BookOpen />}
                            tone="success"
                            loading={loading}
                        />
                    </motion.div>
                    <motion.div variants={itemVariants} className="sm:col-span-2 lg:col-span-1">
                        <StatCard
                            label={t('gradingProgress')}
                            value={`${stats.gradingProgress}%`}
                            hint={t(`term${currentTerm}`)}
                            icon={<FileEdit />}
                            tone="warning"
                            loading={loading}
                        />
                    </motion.div>
                </motion.div>

                {/* ── Quick actions ─────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="size-4 text-muted-foreground" />
                                {t('quickActions')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <Progress
                                value={stats.gradingProgress}
                                label={t('gradingProgress')}
                                valueLabel={`${stats.gradingProgress}%`}
                                tone={
                                    stats.gradingProgress >= 80
                                        ? 'success'
                                        : stats.gradingProgress >= 40
                                            ? 'primary'
                                            : 'warning'
                                }
                            />

                            <Link
                                href="/teacher/classes"
                                className="group flex items-center gap-4 rounded-card border border-border bg-muted/50 px-5 py-4 transition-colors hover:border-primary/40 hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-xs transition-transform group-hover:scale-105">
                                    <FileEdit className="size-5" />
                                </span>
                                <span className="text-sm font-semibold text-foreground">
                                    {t('enterGrades')}
                                </span>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* ── Notices ───────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="size-4 text-muted-foreground" />
                                {tn('institutionNotices')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-[400px] overflow-y-auto">
                            <NoticeFeed />
                        </CardContent>
                    </Card>
                </motion.div>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
