'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    BookOpen,
    Calendar,
    CheckCircle2,
    CreditCard,
    Download,
    ExternalLink,
    FileText,
    HeartHandshake,
    Newspaper,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Zap,
} from 'lucide-react';
import { toast } from 'sonner';

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
import { Dialog } from '@/components/ui/Dialog';

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

    // Self-Service Checkout State (§7d Sandbox Stub)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [targetPlan, setTargetPlan] = useState<'INDIVIDUAL_PRO' | 'INDIVIDUAL_PREMIUM'>('INDIVIDUAL_PRO');
    const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
    const [checkingOut, setCheckingOut] = useState(false);
    const [checkoutResult, setCheckoutResult] = useState<any | null>(null);

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

    const handleOpenCheckout = (plan: 'INDIVIDUAL_PRO' | 'INDIVIDUAL_PREMIUM' = 'INDIVIDUAL_PRO') => {
        setTargetPlan(plan);
        setCheckoutResult(null);
        setIsCheckoutOpen(true);
    };

    const handleCheckout = async () => {
        setCheckingOut(true);
        try {
            const res = await apiClient.post<any>('/billing/individual/checkout', {
                plan: targetPlan,
                billingCycle,
            });
            setCheckoutResult(res);
            setProfile((prev) => prev ? { ...prev, plan: targetPlan } : null);
            toast.success(
                `Subscribed to ${targetPlan === 'INDIVIDUAL_PRO' ? 'Individual Pro' : 'Individual Premium'}! (Sandbox Mode)`,
            );
        } catch (err: any) {
            toast.error(err?.message || 'Failed to complete checkout');
        } finally {
            setCheckingOut(false);
        }
    };

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
                <Card className="flex flex-col justify-between">
                    <div>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardDescription>Individual Subscription</CardDescription>
                                {profile?.plan === 'INDIVIDUAL_PREMIUM' ? (
                                    <Badge tone="info" variant="soft">Max Tier</Badge>
                                ) : profile?.plan === 'INDIVIDUAL_PRO' ? (
                                    <Badge tone="primary" variant="soft">Pro</Badge>
                                ) : (
                                    <Badge tone="neutral" variant="soft">Free</Badge>
                                )}
                            </div>
                            <CardTitle className="text-xl">
                                {profile?.plan === 'FREE_INDIVIDUAL'
                                    ? 'Free Individual'
                                    : profile?.plan === 'INDIVIDUAL_PRO'
                                        ? 'Individual Pro'
                                        : 'Individual Premium'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-muted-foreground">
                            <div>
                                {profile?.activeGrant ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                        <HeartHandshake className="size-3.5" />
                                        Sponsored upgrade active until{' '}
                                        {new Date(
                                            profile.activeGrant.expiresAt,
                                        ).toLocaleDateString()}
                                    </span>
                                ) : (
                                    <span>
                                        {profile?.plan === 'FREE_INDIVIDUAL'
                                            ? '5 AI queries / day • 200 MB storage quota'
                                            : profile?.plan === 'INDIVIDUAL_PRO'
                                                ? '20,000 AI tokens / month • 2 GB offline storage'
                                                : '60,000 AI tokens / month • 8 GB offline storage'}
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </div>
                    <div className="p-6 pt-0">
                        {profile?.plan !== 'INDIVIDUAL_PREMIUM' ? (
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                                onClick={() => handleOpenCheckout(profile?.plan === 'FREE_INDIVIDUAL' ? 'INDIVIDUAL_PRO' : 'INDIVIDUAL_PREMIUM')}
                            >
                                <Zap className="size-3.5 text-amber-500 fill-amber-500" />
                                Upgrade Plan (from LKR 299/mo)
                            </Button>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                <ShieldCheck className="size-4" />
                                Premium Member (All features unlocked)
                            </div>
                        )}
                    </div>
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

            {/* ── Self-Service Checkout Dialog (§7d) ────────────────── */}
            <Dialog
                open={isCheckoutOpen}
                onClose={() => {
                    setIsCheckoutOpen(false);
                    setCheckoutResult(null);
                }}
                size="lg"
                title={checkoutResult ? 'Upgrade Confirmed' : 'Upgrade Independent Learner Tier'}
                description={
                    checkoutResult
                        ? 'Your self-service upgrade has been processed and entitlements are active.'
                        : 'Select your tier to unlock advanced AI academic features, encrypted offline downloads, and exam prediction.'
                }
            >
                {checkoutResult ? (
                    <div className="space-y-4 py-2">
                        <div className="flex flex-col items-center justify-center gap-3 rounded-card bg-emerald-500/10 p-6 text-center border border-emerald-500/20">
                            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <CheckCircle2 className="size-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    {checkoutResult.plan === 'INDIVIDUAL_PRO' ? 'Individual Pro' : 'Individual Premium'} Activated
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Transaction Reference:{' '}
                                    <span className="font-mono font-medium text-foreground">
                                        {checkoutResult.transactionId}
                                    </span>
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                                <Badge tone="success" variant="soft">
                                    Billed LKR {checkoutResult.amountLkr} / {checkoutResult.billingCycle?.toLowerCase()}
                                </Badge>
                                <Badge tone="primary" variant="soft">
                                    Sandbox Gateway Stub
                                </Badge>
                            </div>
                        </div>

                        <div className="rounded-card border border-border bg-muted/40 p-4 text-xs space-y-2 text-muted-foreground">
                            <div className="flex items-center gap-2 font-medium text-foreground">
                                <ShieldCheck className="size-4 text-emerald-500" />
                                Active Entitlements:
                            </div>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>
                                    {checkoutResult.plan === 'INDIVIDUAL_PREMIUM' ? '60,000 AI tokens/month' : '20,000 AI tokens/month'} for subject-stream Qwen RAG
                                </li>
                                <li>
                                    {checkoutResult.plan === 'INDIVIDUAL_PREMIUM' ? '8 GB' : '2 GB'} encrypted offline video downloads & past papers
                                </li>
                                <li>Personalized Exam Prediction signals enabled</li>
                                {checkoutResult.plan === 'INDIVIDUAL_PREMIUM' && (
                                    <li>Inclusion in National Independent-Learner Leaderboard</li>
                                )}
                            </ul>
                        </div>

                        <div className="rounded-card bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/20">
                            <span className="font-semibold">Note on Payment Gateway:</span> {checkoutResult.notice}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setIsCheckoutOpen(false);
                                    setCheckoutResult(null);
                                }}
                            >
                                Back to Learning Hub
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5 py-2">
                        {/* Billing Cadence Selector */}
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setBillingCycle('MONTHLY')}
                                className={`rounded-pill px-4 py-1.5 text-xs font-medium transition-all ${billingCycle === 'MONTHLY'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                Monthly Billing
                            </button>
                            <button
                                type="button"
                                onClick={() => setBillingCycle('ANNUAL')}
                                className={`flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-medium transition-all ${billingCycle === 'ANNUAL'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                            >
                                Annual Billing
                                <span className="rounded-pill bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                                    Save 2 Months
                                </span>
                            </button>
                        </div>

                        {/* Plan Options Grid */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* Individual Pro */}
                            <div
                                onClick={() => setTargetPlan('INDIVIDUAL_PRO')}
                                className={`cursor-pointer rounded-card border p-4 transition-all ${targetPlan === 'INDIVIDUAL_PRO'
                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-sm'
                                    : 'border-border bg-card hover:border-primary/50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-foreground">Individual Pro</h4>
                                    {targetPlan === 'INDIVIDUAL_PRO' && (
                                        <Badge tone="primary" variant="solid">Selected</Badge>
                                    )}
                                </div>
                                <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                                    {billingCycle === 'MONTHLY' ? 'LKR 299' : 'LKR 2,990'}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {billingCycle === 'MONTHLY' ? ' / month' : ' / year'}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Ideal for serious private candidates preparing for national exams.
                                </p>
                                <ul className="mt-3 space-y-1.5 text-xs text-foreground/80">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span><strong>20,000 AI tokens/month</strong> (Qwen RAG)</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span><strong>2 GB</strong> Encrypted offline downloads</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>Personalized Exam Prediction signals</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>Ad-free & priority paper indexing</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Individual Premium */}
                            <div
                                onClick={() => setTargetPlan('INDIVIDUAL_PREMIUM')}
                                className={`cursor-pointer rounded-card border p-4 transition-all ${targetPlan === 'INDIVIDUAL_PREMIUM'
                                    ? 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-500/5 shadow-sm'
                                    : 'border-border bg-card hover:border-purple-500/50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <h4 className="font-bold text-sm text-foreground">Individual Premium</h4>
                                        <span className="rounded-pill bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-300">
                                            Pro Max
                                        </span>
                                    </div>
                                    {targetPlan === 'INDIVIDUAL_PREMIUM' && (
                                        <Badge tone="info" variant="solid">Selected</Badge>
                                    )}
                                </div>
                                <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                                    {billingCycle === 'MONTHLY' ? 'LKR 599' : 'LKR 5,990'}
                                    <span className="text-xs font-normal text-muted-foreground">
                                        {billingCycle === 'MONTHLY' ? ' / month' : ' / year'}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Highest allowance for top-rank ambitious students.
                                </p>
                                <ul className="mt-3 space-y-1.5 text-xs text-foreground/80">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-purple-500 shrink-0" />
                                        <span><strong>60,000 AI tokens/month</strong> allowance</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-purple-500 shrink-0" />
                                        <span><strong>8 GB</strong> Offline video & paper storage</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-purple-500 shrink-0" />
                                        <span>Early access to new syllabus revisions</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-purple-500 shrink-0" />
                                        <span>National Independent Leaderboard inclusion</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Architecture / Payment Gateway Sandbox Callout */}
                        <div className="rounded-card border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                            <div className="flex items-start gap-2">
                                <CreditCard className="size-4 text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">Sandbox Payment Gateway Stub Active:</span>{' '}
                                    In this development phase, self-service checkout is fulfilled via our backend payment stub (ADR Blueprint §7d). Production integration with Sri Lankan payment providers (PayHere IPG / Stripe Sri Lanka Checkout) will go live in Phase 4 / Sprint 8. Confirming below will immediately activate your upgraded tier.
                                </div>
                            </div>
                        </div>

                        {/* Dialog Footer Actions */}
                        <div className="flex items-center justify-between border-t border-border pt-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsCheckoutOpen(false)}
                                disabled={checkingOut}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleCheckout}
                                disabled={checkingOut || profile?.plan === targetPlan}
                                className="gap-2"
                            >
                                {checkingOut ? (
                                    <>
                                        <Spinner text="" className="size-4" />
                                        <span>Processing Upgrade...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>
                                            Confirm Upgrade (LKR{' '}
                                            {targetPlan === 'INDIVIDUAL_PRO'
                                                ? billingCycle === 'MONTHLY' ? '299' : '2,990'
                                                : billingCycle === 'MONTHLY' ? '599' : '5,990'}
                                            )
                                        </span>
                                        <ArrowRight className="size-3.5" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
