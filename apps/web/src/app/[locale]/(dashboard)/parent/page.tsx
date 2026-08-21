'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, ChevronRight, GraduationCap, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import NoticeFeed from '@/components/notices/NoticeFeed';
import { Avatar } from '@/components/ui/Avatar';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { EmptyState, SectionHeading } from '@/components/ui/Layout';

export default function ParentDashboard() {
    const t = useTranslations('ParentDashboard');
    const tn = useTranslations('Notices');
    const searchParams = useSearchParams();
    const query = searchParams.get('query') || '';

    const [parentName, setParentName] = useState('');
    const [childrenData, setChildrenData] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const data = await apiClient.get<any>('/parents/me');
                setParentName(data?.users?.full_name || '');
                setChildrenData(data?.children ?? []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoaded(true);
            }
        };
        init();
    }, []);

    const filteredChildren = childrenData.filter(
        (child) => child.name?.toLowerCase().includes(query.toLowerCase()) ?? false,
    );

    return (
        <TutorialProvider role="PARENT" screenId="dashboard">
            <div className="mx-auto max-w-5xl space-y-6" id="nav-dashboard">
                {/* ── Hero ──────────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative isolate overflow-hidden rounded-card bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-card sm:p-8"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full bg-white/10 blur-3xl"
                    />
                    <div className="relative flex items-center justify-between gap-6">
                        <div className="min-w-0">
                            <h1 className="text-display-sm text-white">
                                {t('greeting')} {parentName || '…'}
                            </h1>
                            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80">
                                {t('dashboardSubtitle')}
                            </p>
                        </div>
                        <span className="hidden size-14 shrink-0 place-items-center rounded-card border border-white/20 bg-white/10 backdrop-blur-sm md:grid">
                            <Users className="size-7" />
                        </span>
                    </div>
                </motion.section>

                {/* ── Children ──────────────────────────────────────────────── */}
                <section>
                    <SectionHeading title={t('linkedChildren')} />

                    {filteredChildren.length === 0 ? (
                        <Card>
                            <EmptyState
                                icon={<GraduationCap />}
                                title={
                                    !loaded
                                        ? t('linkedChildren')
                                        : childrenData.length === 0
                                            ? t('noChildren')
                                            : t('noMatches')
                                }
                                description={
                                    loaded && childrenData.length === 0
                                        ? t('noChildrenDesc')
                                        : undefined
                                }
                            />
                        </Card>
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2">
                            {filteredChildren.map((child, idx) => (
                                <motion.div
                                    key={child.id ?? idx}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        transition: { delay: Math.min(idx * 0.08, 0.4) },
                                    }}
                                >
                                    <Link
                                        id={`nav-child-${idx}`}
                                        href={`/parent/students/${child.id}/grades`}
                                        className="block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                    >
                                        <Card interactive className="group h-full">
                                            <CardContent className="flex h-full flex-col pt-5">
                                                <div className="flex items-center gap-3.5">
                                                    <Avatar name={child.name} size="lg" />
                                                    <div className="min-w-0">
                                                        <p className="truncate font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                                                            {child.name}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                                            {child.grade ||
                                                                t('gradeNotAssigned')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className="mt-5 flex items-center justify-center gap-1.5 rounded-input border border-border bg-muted/50 py-2.5 text-[13px] font-semibold text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary-subtle">
                                                    {t('viewAcademicReport')}
                                                    <ChevronRight className="size-4" />
                                                </span>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Notices ───────────────────────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bell className="size-4 text-muted-foreground" />
                            {tn('latestNotices')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[420px] overflow-y-auto">
                        <NoticeFeed />
                    </CardContent>
                </Card>

                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
