'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BookOpen,
    Calendar,
    Download,
    ExternalLink,
    FileText,
    HeartHandshake,
    Newspaper,
    ShieldAlert,
    Sparkles,
} from 'lucide-react';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/Badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface LearnerProfile {
    fullName: string;
    email: string;
    plan: string;
    learnerType: string;
    candidateLevel: string;
    stream: string;
    activeGrant?: {
        fromPlan: string;
        toPlan: string;
        expiresAt: string;
        notes?: string;
    } | null;
}

export default function IndependentLearnerDashboard() {
    const [profile, setProfile] = useState<LearnerProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await apiClient.get<any>('/users/me', {
                    skipGlobalToast: true,
                });
                const learner = data?.independent_learner;
                const grant = data?.active_grant;

                setProfile({
                    fullName: data?.full_name || 'Candidate',
                    email: data?.email || '',
                    plan: learner?.plan || 'FREE_INDIVIDUAL',
                    learnerType: learner?.learner_type || 'OUT_OF_SCHOOL',
                    candidateLevel: learner?.candidate_level || 'AL',
                    stream: learner?.stream || 'SCIENCE',
                    activeGrant: grant
                        ? {
                            fromPlan: grant.from_plan,
                            toPlan: grant.to_plan,
                            expiresAt: grant.expires_at,
                            notes: grant.notes,
                        }
                        : null,
                });
            } catch {
                // Fallback from authManager if network fails
                setProfile({
                    fullName: 'Independent Candidate',
                    email: '',
                    plan: 'FREE_INDIVIDUAL',
                    learnerType: 'OUT_OF_SCHOOL',
                    candidateLevel: 'AL',
                    stream: 'GENERAL',
                });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    // Calculate mock exam countdown
    const examYear = new Date().getFullYear();
    const alExamDate = new Date(`${examYear}-11-25T08:30:00`);
    const diffDays = Math.max(
        0,
        Math.ceil((alExamDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    if (loading) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <Spinner text="Loading candidate portal..." />
            </div>
        );
    }

    return (
        <div className="space-y-6" id="nav-dashboard">
            {/* ── Hero Banner ────────────────────────────────────────── */}
            <motion.section
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="relative isolate overflow-hidden rounded-card bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 p-6 text-white shadow-card sm:p-8"
            >
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-blue-500/20 blur-3xl"
                />

                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                                <Sparkles className="size-3.5 text-amber-300" />
                                Independent Learner Portal
                            </span>
                            {profile?.activeGrant && (
                                <span className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-500/25 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm border border-emerald-400/30">
                                    <HeartHandshake className="size-3.5" />
                                    EduLanka Sponsored Grant Active
                                </span>
                            )}
                        </div>

                        <h1 className="mt-3 text-display-sm text-white">
                            Welcome, {profile?.fullName || 'Candidate'}
                        </h1>
                        <p className="mt-1 max-w-xl text-sm leading-relaxed text-blue-100/80">
                            Self-directed study access to official Sri Lankan national syllabus materials, past papers, marking schemes, and educational discourse.
                        </p>
                    </div>

                    {/* Quick Countdown Box */}
                    <div className="flex shrink-0 items-center gap-3 rounded-card border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-md">
                        <Calendar className="size-8 text-blue-300" />
                        <div>
                            <div className="text-2xl font-bold tracking-tight text-white">
                                {diffDays} Days
                            </div>
                            <div className="text-xs text-blue-200">
                                G.C.E. A/L Examination
                            </div>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ── Status & Plan Allocation ───────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Individual Plan</CardDescription>
                        <CardTitle className="text-xl">
                            {profile?.plan === 'FREE_INDIVIDUAL'
                                ? 'Free Individual'
                                : profile?.plan === 'INDIVIDUAL_PRO'
                                    ? 'Individual Pro'
                                    : 'Individual Premium'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        {profile?.activeGrant ? (
                            <span className="text-emerald-600 font-medium">
                                Sponsored upgrade active until{' '}
                                {new Date(
                                    profile.activeGrant.expiresAt,
                                ).toLocaleDateString()}
                            </span>
                        ) : (
                            'Public past papers & national syllabus access enabled.'
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Target Exam Track</CardDescription>
                        <CardTitle className="text-xl">
                            G.C.E. {profile?.candidateLevel || 'A/L'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Stream: {profile?.stream || 'Science / Commerce / Arts'}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>EduLanka Sponsored Growth</CardDescription>
                        <CardTitle className="text-xl">
                            {profile?.activeGrant ? 'Funded' : 'Open Pool'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        {profile?.activeGrant
                            ? 'Supported via EduLanka Social Profit Pool (§9)'
                            : 'Eligible for sponsored upgrades based on merit & community pool.'}
                    </CardContent>
                </Card>
            </div>

            {/* ── Core Study Features ─────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <Link
                    href="/student/papers"
                    className="group flex flex-col justify-between rounded-card border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-card"
                >
                    <div>
                        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-input bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <FileText className="size-5" />
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            Past Papers & Schemes
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Official O/L and A/L exam papers with bilingual marking schemes and step-by-step model answers.
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary">
                        Browse Catalog <ExternalLink className="size-3.5" />
                    </div>
                </Link>

                <Link
                    href="/student/resources"
                    className="group flex flex-col justify-between rounded-card border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-card"
                >
                    <div>
                        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-input bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <BookOpen className="size-5" />
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                            Curated Resources
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Download government textbooks, curriculum syllabus guides, and supplementary reference notes.
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600">
                        View Resources <ExternalLink className="size-3.5" />
                    </div>
                </Link>

                <Link
                    href="/blogs"
                    className="group flex flex-col justify-between rounded-card border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-card"
                >
                    <div>
                        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-input bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Newspaper className="size-5" />
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-emerald-600 transition-colors">
                            Academic Discourse
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Read subject analysis, study methodologies, and discourse published by verified educators.
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        Explore Articles <ExternalLink className="size-3.5" />
                    </div>
                </Link>

                <Link
                    href="/emergency"
                    className="group flex flex-col justify-between rounded-card border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-card"
                >
                    <div>
                        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-input bg-rose-500/10 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                            <ShieldAlert className="size-5" />
                        </div>
                        <h3 className="font-semibold text-foreground group-hover:text-rose-600 transition-colors">
                            Emergency Pack
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            Offline emergency contacts, natural disaster evacuation shelters, and weather safety policies.
                        </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-rose-600">
                        Safety Guidance <ExternalLink className="size-3.5" />
                    </div>
                </Link>
            </div>

            {/* ── Suggested Past Paper Highlights ─────────────────────── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Recommended G.C.E. Past Papers</CardTitle>
                            <CardDescription>
                                High-priority examination papers for independent review
                            </CardDescription>
                        </div>
                        <Link href="/student/papers">
                            <Button variant="outline" size="sm">
                                View All Papers
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="divide-y divide-border">
                        {[
                            {
                                title: '2025 G.C.E. A/L Combined Mathematics Part I & II',
                                stream: 'Physical Science',
                                medium: 'Sinhala / English',
                                year: 2025,
                            },
                            {
                                title: '2025 G.C.E. A/L Chemistry Part I & II',
                                stream: 'Bio / Physical Science',
                                medium: 'Sinhala / English / Tamil',
                                year: 2025,
                            },
                            {
                                title: '2025 G.C.E. A/L Accounting Part I & II',
                                stream: 'Commerce',
                                medium: 'Sinhala / English',
                                year: 2025,
                            },
                            {
                                title: '2024 G.C.E. O/L Mathematics with Marking Scheme',
                                stream: 'General',
                                medium: 'Sinhala / English / Tamil',
                                year: 2024,
                            },
                        ].map((paper, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="space-y-1">
                                    <div className="font-medium text-sm text-foreground">
                                        {paper.title}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <Badge tone="neutral" variant="soft">{paper.stream}</Badge>
                                        <span>•</span>
                                        <span>{paper.medium}</span>
                                        <span>•</span>
                                        <span>Year {paper.year}</span>
                                    </div>
                                </div>
                                <Link href="/student/papers">
                                    <Button variant="ghost" size="sm" className="gap-1.5 self-start sm:self-center">
                                        <Download className="size-3.5" /> Download
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
