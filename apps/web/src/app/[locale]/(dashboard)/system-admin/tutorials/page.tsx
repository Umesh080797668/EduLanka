'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Compass,
    PlusCircle,
    CheckCircle2,
    Layers,
    ChevronDown,
    ChevronUp,
    Save,
    Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Form';
import { PageHeader, EmptyState } from '@/components/ui/Layout';
import { Dialog } from '@/components/ui/Dialog';
import { StatCard } from '@/components/ui/Stat';

interface TutorialStep {
    id?: string;
    step_order: number;
    target_element?: string;
    title_en: string;
    title_si?: string;
    title_ta?: string;
    content_en: string;
    content_si?: string;
    content_ta?: string;
}

interface TutorialRecord {
    id: string;
    role: string;
    screen_id: string;
    is_active: boolean;
    created_at: string;
    tutorial_steps?: TutorialStep[];
}

export default function SystemAdminTutorialsPage() {
    const t = useTranslations('SystemAdminTutorials');
    const [tutorials, setTutorials] = useState<TutorialRecord[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Create tutorial modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [role, setRole] = useState('SCHOOL_ADMIN');
    const [screenId, setScreenId] = useState('dashboard');
    const [isActive, setIsActive] = useState(true);
    const [steps, setSteps] = useState<TutorialStep[]>([
        {
            step_order: 1,
            target_element: '#nav-dashboard',
            title_en: 'Welcome to your Dashboard',
            content_en: 'This overview displays key platform metrics, active schools, and real-time status.',
        },
    ]);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [tutRes, statsRes] = await Promise.all([
                apiClient.get<TutorialRecord[]>('/system-admin/tutorials', { skipGlobalToast: true }),
                apiClient.get<any>('/system-admin/tutorials/stats', { skipGlobalToast: true }).catch(() => null),
            ]);
            if (Array.isArray(tutRes)) {
                setTutorials(tutRes);
            }
            if (statsRes) {
                setStats(statsRes);
            }
        } catch {
            toast.error(t('loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            try {
                const [tutRes, statsRes] = await Promise.all([
                    apiClient.get<TutorialRecord[]>('/system-admin/tutorials', { skipGlobalToast: true }),
                    apiClient.get<any>('/system-admin/tutorials/stats', { skipGlobalToast: true }).catch(() => null),
                ]);
                if (isMounted && Array.isArray(tutRes)) {
                    setTutorials(tutRes);
                }
                if (isMounted && statsRes) {
                    setStats(statsRes);
                }
            } catch {
                if (isMounted) toast.error(t('loadFailed'));
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        void loadInitial();
        return () => {
            isMounted = false;
        };
    }, [t]);

    const handleAddStep = () => {
        setSteps((prev) => [
            ...prev,
            {
                step_order: prev.length + 1,
                target_element: '',
                title_en: '',
                content_en: '',
            },
        ]);
    };

    const handleRemoveStep = (index: number) => {
        setSteps((prev) => prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, step_order: idx + 1 })));
    };

    const handleStepChange = (index: number, field: keyof TutorialStep, val: any) => {
        setSteps((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [field]: val };
            return copy;
        });
    };

    const handleCreateTutorial = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await apiClient.post(
                '/system-admin/tutorials',
                {
                    role,
                    screen_id: screenId,
                    is_active: isActive,
                    steps,
                },
                { skipGlobalToast: true },
            );
            toast.success(t('tutorialSaved'));
            setShowCreateModal(false);
            void fetchData();
        } catch (err: any) {
            toast.error(err?.message || t('saveFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    const totalTours = tutorials.length;
    const activeTours = tutorials.filter((t) => t.is_active).length;
    const statsList = Array.isArray(stats?.data) ? stats.data : Object.values(stats ?? {});
    const totalCompletions = statsList.reduce((acc: number, s: any) => acc + (s.completed ?? 0), 0);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    icon={<Compass />}
                    title={t('title')}
                    description={t('subtitle')}
                />
                <Button
                    type="button"
                    variant="primary"
                    onClick={() => setShowCreateModal(true)}
                    leadingIcon={<PlusCircle />}
                >
                    {t('createTutorial')}
                </Button>
            </div>

            {/* Metrics Overview */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Configured Tours"
                    value={totalTours}
                    icon={<Compass />}
                    tone="primary"
                    hint={`${activeTours} active tours`}
                />
                <StatCard
                    label="Platform Completions"
                    value={totalCompletions}
                    icon={<CheckCircle2 />}
                    tone="success"
                    hint="Completed across all schools"
                />
                <StatCard
                    label="Target Roles"
                    value="5 Roles"
                    icon={<Layers />}
                    tone="info"
                    hint="Students, Parents, Teachers, Admins"
                />
            </div>

            {/* Tutorials List */}
            <Card>
                <CardHeader>
                    <CardTitle as="h2" className="flex items-center gap-2">
                        <Compass className="size-4 text-brand-600 dark:text-brand-400" />
                        Guided Walkthrough Tours
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-6 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
                            ))}
                        </div>
                    ) : tutorials.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={<Compass className="size-8" />}
                                title={t('noTutorials')}
                                description="Create walkthrough steps to assist users when they navigate the application."
                            />
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {tutorials.map((tut) => {
                                const isExpanded = expandedId === tut.id;
                                const stepCount = tut.tutorial_steps?.length || 0;
                                return (
                                    <div key={tut.id} className="transition-colors hover:bg-muted/20">
                                        <div
                                            className="flex cursor-pointer items-center justify-between p-4"
                                            onClick={() => setExpandedId(isExpanded ? null : tut.id)}
                                        >
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Badge size="sm" variant="soft" tone="primary">
                                                    {tut.role}
                                                </Badge>
                                                <span className="font-semibold text-foreground text-sm">
                                                    Screen: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{tut.screen_id}</code>
                                                </span>
                                                <Badge
                                                    size="sm"
                                                    tone={tut.is_active ? 'success' : 'neutral'}
                                                >
                                                    {tut.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                                                </span>
                                            </div>

                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                aria-label="Toggle steps"
                                            >
                                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                            </Button>
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="overflow-hidden border-t border-border bg-muted/30 px-6 py-4"
                                                >
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                                        Tour Steps & Targeting Anchors
                                                    </h4>
                                                    {tut.tutorial_steps && tut.tutorial_steps.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {tut.tutorial_steps.map((step) => (
                                                                <div
                                                                    key={step.id || step.step_order}
                                                                    className="rounded-lg border border-border bg-background p-3 text-xs space-y-1"
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-bold text-foreground">
                                                                            Step {step.step_order}: {step.title_en}
                                                                        </span>
                                                                        {step.target_element ? (
                                                                            <code className="text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/40 px-1.5 py-0.5 rounded font-mono">
                                                                                {step.target_element}
                                                                            </code>
                                                                        ) : (
                                                                            <span className="text-muted-foreground italic">Modal / Centered</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-foreground/80 leading-relaxed">
                                                                        {step.content_en}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">No steps configured for this tutorial.</p>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Tutorial Modal */}
            <Dialog
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={t('createTutorial')}
                icon={<Compass className="size-5" />}
                size="lg"
            >
                <form onSubmit={handleCreateTutorial} className="space-y-5 pt-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('fieldRole')} htmlFor="tut-role" required>
                            <Select
                                id="tut-role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value="STUDENT">STUDENT</option>
                                <option value="PARENT">PARENT</option>
                                <option value="TEACHER">TEACHER</option>
                                <option value="SCHOOL_ADMIN">SCHOOL_ADMIN</option>
                                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </Select>
                        </Field>

                        <Field label={t('fieldScreen')} htmlFor="tut-screen" required>
                            <Input
                                id="tut-screen"
                                required
                                value={screenId}
                                onChange={(e) => setScreenId(e.target.value)}
                                placeholder="e.g. dashboard, grades, policy..."
                            />
                        </Field>
                    </div>

                    <div className="rounded-card border border-border p-3.5 bg-muted/20">
                        <Switch
                            id="tut-active-toggle"
                            checked={isActive}
                            onCheckedChange={setIsActive}
                            label={t('fieldActive')}
                        />
                    </div>

                    {/* Steps Editor */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground">
                                Steps Configuration ({steps.length})
                            </h4>
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={handleAddStep}
                                leadingIcon={<PlusCircle className="size-3.5" />}
                            >
                                Add Step
                            </Button>
                        </div>

                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                            {steps.map((st, idx) => (
                                <div
                                    key={idx}
                                    className="rounded-card border border-border bg-muted/30 p-3.5 space-y-3 text-xs"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-foreground">
                                            Step #{st.step_order}
                                        </span>
                                        {steps.length > 1 && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => handleRemoveStep(idx)}
                                                leadingIcon={<Trash2 className="size-3" />}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <Field label="Anchor Selector (ID or Class)" htmlFor={`step-target-${idx}`}>
                                            <Input
                                                id={`step-target-${idx}`}
                                                value={st.target_element || ''}
                                                onChange={(e) => handleStepChange(idx, 'target_element', e.target.value)}
                                                placeholder="#element-id or leave empty for center"
                                            />
                                        </Field>

                                        <Field label="Title (English)" htmlFor={`step-title-${idx}`} required>
                                            <Input
                                                id={`step-title-${idx}`}
                                                required
                                                value={st.title_en}
                                                onChange={(e) => handleStepChange(idx, 'title_en', e.target.value)}
                                                placeholder="Title of this step..."
                                            />
                                        </Field>
                                    </div>

                                    <Field label="Content (English)" htmlFor={`step-content-${idx}`} required>
                                        <Textarea
                                            id={`step-content-${idx}`}
                                            required
                                            rows={2}
                                            value={st.content_en}
                                            onChange={(e) => handleStepChange(idx, 'content_en', e.target.value)}
                                            placeholder="Explain what the user should do on this element..."
                                        />
                                    </Field>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-border">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setShowCreateModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            loading={submitting}
                            leadingIcon={<Save />}
                        >
                            {t('saveTutorial')}
                        </Button>
                    </div>
                </form>
            </Dialog>
        </div>
    );
}
