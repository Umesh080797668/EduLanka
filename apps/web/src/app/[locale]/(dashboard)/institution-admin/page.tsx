'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    Building,
    ChevronRight,
    Settings,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { DisasterModeModal } from '@/components/DisasterModeModal';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import {
    Card,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { DashboardCardsSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/Stat';

const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function InstitutionAdminDashboard() {
    const t = useTranslations('InstitutionAdminDashboard');
    const [stats, setStats] = useState<any>(null);
    const [isDisasterModalOpen, setDisasterModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await apiClient.get<any>('/tenants/stats');
                setStats(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const triggerDisasterMode = async (reason: string, resumeDate: string) => {
        try {
            await apiClient.post('/tenants/disaster-mode', { reason, resumeDate });
            toast.success(t('disasterSuccess'), {
                description: t('disasterSuccessDesc'),
            });
            setDisasterModalOpen(false);
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            toast.error(t('disasterFailed'), {
                description: e?.response?.data?.message || t('disasterFailedDesc'),
            });
            setDisasterModalOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl space-y-6">
                <DashboardCardsSkeleton />
            </div>
        );
    }

    return (
        <TutorialProvider role="SCHOOL_ADMIN" screenId="dashboard">
            <div className="mx-auto max-w-6xl space-y-6">
                {/* ── Hero ──────────────────────────────────────────────────── */}
                <motion.section
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="relative isolate overflow-hidden rounded-card bg-gradient-to-br from-brand-800 to-brand-950 p-6 text-white shadow-card sm:p-8"
                    id="nav-dashboard"
                >
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full bg-brand-400/25 blur-3xl"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -bottom-24 left-10 size-48 rounded-full bg-white/10 blur-3xl"
                    />

                    <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
                        <div>
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="size-7 text-brand-300" />
                                <h1 className="text-display-sm text-white">
                                    {t('schoolAdmin')}
                                </h1>
                            </div>
                            <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/75">
                                {t('dashboardSubtitle')}
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <Link
                                    id="nav-users"
                                    href="/institution-admin/students"
                                    className="inline-flex h-10 items-center gap-2 rounded-input bg-white px-4 text-sm font-semibold text-brand-900 shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                >
                                    <Users className="size-4" />
                                    {t('manageUsers')}
                                </Link>
                                <Link
                                    id="nav-policies"
                                    href="/institution-admin/policy"
                                    className="inline-flex h-10 items-center gap-2 rounded-input border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                >
                                    <Settings className="size-4" />
                                    {t('schoolPolicies')}
                                </Link>
                            </div>
                        </div>

                        {/* Emergency protocol — deliberately visually separated. */}
                        <div className="flex max-w-sm gap-4 rounded-card border border-danger/30 bg-danger/15 p-4 backdrop-blur-md">
                            <span className="grid size-11 shrink-0 place-items-center rounded-input bg-danger/25 text-danger-200">
                                <AlertTriangle className="size-6" />
                            </span>
                            <div>
                                <h2 className="text-sm font-semibold text-white">
                                    {t('disasterModeTitle')}
                                </h2>
                                <p className="mt-1 text-xs leading-relaxed text-white/70">
                                    {t('disasterModeDesc')}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setDisasterModalOpen(true)}
                                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-input bg-danger-600 px-3 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-danger-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                                >
                                    {t('engageProtocol')}
                                </button>
                            </div>
                        </div>
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
                            label={t('totalActiveUsers')}
                            value={stats?.users ?? 0}
                            icon={<Users />}
                            tone="info"
                        />
                    </motion.div>
                    <motion.div variants={itemVariants}>
                        <StatCard
                            label={t('classesEnrolled')}
                            value={stats?.classes ?? 0}
                            icon={<Building />}
                            tone="success"
                        />
                    </motion.div>
                </motion.div>

                {/* ── Administration links ──────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card flush>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="size-4 text-muted-foreground" />
                                {t('institutionAdministration')}
                            </CardTitle>
                        </CardHeader>

                        <div className="divide-y divide-border border-t border-border">
                            {[
                                {
                                    href: '/institution-admin/students',
                                    icon: <Users className="size-5" />,
                                    title: t('userDirectory'),
                                    desc: t('userDirectoryDesc'),
                                },
                                {
                                    href: '/institution-admin/policy',
                                    icon: <Settings className="size-5" />,
                                    title: t('schoolPoliciesTitle'),
                                    desc: t('schoolPoliciesDesc'),
                                },
                            ].map((row) => (
                                <Link
                                    key={row.href}
                                    href={row.href}
                                    className="group flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-6"
                                >
                                    <div className="flex min-w-0 items-center gap-4">
                                        <span className="grid size-10 shrink-0 place-items-center rounded-input bg-muted text-muted-foreground transition-colors group-hover:bg-primary-subtle group-hover:text-primary">
                                            {row.icon}
                                        </span>
                                        <div className="min-w-0">
                                            <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                                                {row.title}
                                            </h3>
                                            <p className="truncate text-sm text-muted-foreground">
                                                {row.desc}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                                </Link>
                            ))}
                        </div>
                    </Card>
                </motion.div>

                <HelpButton />

                <DisasterModeModal
                    isOpen={isDisasterModalOpen}
                    onClose={() => setDisasterModalOpen(false)}
                    onConfirm={triggerDisasterMode}
                />
            </div>
        </TutorialProvider>
    );
}
