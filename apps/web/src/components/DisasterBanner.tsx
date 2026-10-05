'use client';

import * as React from 'react';
import { AlertTriangle, HelpCircle, Calendar, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface TenantStatsResponse {
    name?: string;
    schoolName?: string;
    disasterMode?: boolean;
    disasterReason?: string | null;
    disasterResumeDate?: string | null;
}

export default function DisasterBanner() {
    const t = useTranslations('DisasterMode');
    const [stats, setStats] = React.useState<TenantStatsResponse | null>(null);
    const [showExplanation, setShowExplanation] = React.useState(false);

    const formatReason = React.useCallback(
        (raw?: string | null): string => {
            if (!raw) return t('emergency');
            const keyMap: Record<string, string> = {
                FLOOD: 'flood',
                CYCLONE: 'cyclone',
                SEVERE_WEATHER: 'severeWeather',
                LANDSLIDE: 'landslide',
                PUBLIC_HEALTH: 'publicHealth',
                OTHER: 'other',
            };
            const translationKey = keyMap[raw];
            return translationKey ? t(translationKey as any) : raw;
        },
        [t],
    );

    const checkDisasterStatus = React.useCallback(async () => {
        try {
            const data = await apiClient.get<TenantStatsResponse>('/tenants/stats', {
                skipGlobalToast: true,
            });
            if (data) {
                setStats(data);
            }
        } catch {
            // Silently ignore if not authorized or network failure
        }
    }, []);

    React.useEffect(() => {
        let isMounted = true;
        const loadInitial = async () => {
            try {
                const data = await apiClient.get<TenantStatsResponse>('/tenants/stats', {
                    skipGlobalToast: true,
                });
                if (isMounted && data) {
                    setStats(data);
                }
            } catch {
                // Silently ignore
            }
        };

        void loadInitial();

        // Check periodically every 60 seconds
        const interval = setInterval(() => {
            void checkDisasterStatus();
        }, 60000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [checkDisasterStatus]);

    if (!stats?.disasterMode) {
        return null;
    }

    const localizedReason = formatReason(stats.disasterReason);
    const resumeDate = stats.disasterResumeDate || t('tbd');

    return (
        <>
            <aside
                role="alert"
                aria-label={t('disasterActiveTitle')}
                className="relative z-30 w-full border-b border-danger-700/40 bg-gradient-to-r from-danger-700 via-danger-600 to-danger-800 text-white shadow-md"
            >
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/20 text-white shadow-inner">
                            <AlertTriangle className="size-5 animate-pulse text-amber-200" />
                        </span>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                                    {t('disasterActiveTitle')}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
                                    {localizedReason}
                                </span>
                            </div>
                            <p className="text-xs text-white/90">
                                <span className="inline-flex items-center gap-1 font-medium">
                                    <Calendar className="size-3.5 opacity-80" />
                                    {t('resumeLabel')}: {resumeDate}
                                </span>
                                <span className="mx-1.5 opacity-60">•</span>
                                <span>{t('smsExplanationBody').slice(0, 90)}...</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowExplanation(true)}
                            className="bg-white/15 text-white hover:bg-white/25 border-white/20 text-xs font-semibold backdrop-blur-sm"
                        >
                            <HelpCircle className="size-3.5 mr-1 text-amber-200" />
                            {t('whatSmsMeans')}
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Explanation Modal */}
            <Dialog
                open={showExplanation}
                onClose={() => setShowExplanation(false)}
                title={t('smsExplanationTitle')}
                icon={<ShieldAlert className="size-5" />}
                tone="danger"
                size="md"
                footer={
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setShowExplanation(false)}
                    >
                        Understood
                    </Button>
                }
            >
                <div className="space-y-4 text-sm text-foreground/80">
                    <p className="leading-relaxed">
                        {t('smsExplanationBody')}
                    </p>
                    <div className="rounded-card border border-danger-500/20 bg-danger-50 dark:bg-danger-950/30 p-3.5 text-xs">
                        <div className="font-semibold text-danger-900 dark:text-danger-200 mb-1">
                            Current Closure Status:
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-danger-800 dark:text-danger-300">
                            <li><strong>Reason:</strong> {localizedReason}</li>
                            <li><strong>Expected Resumption Date:</strong> {resumeDate}</li>
                        </ul>
                    </div>
                </div>
            </Dialog>
        </>
    );
}
