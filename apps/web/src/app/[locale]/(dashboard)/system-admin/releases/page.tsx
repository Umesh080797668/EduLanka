'use client';

import React, { useEffect, useState } from 'react';
import {
    AlertOctagon,
    CheckCircle2,
    Save,
    Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';

interface MobileVersionData {
    minVersion: string;
    latestVersion: string;
    releaseNotes: string;
    forceUpdate: boolean;
}

export default function MobileReleasesPage() {
    const t = useTranslations('MobileReleases');
    const [minVersion, setMinVersion] = useState('1.0.0');
    const [latestVersion, setLatestVersion] = useState('1.0.0');
    const [releaseNotes, setReleaseNotes] = useState('');
    const [forceUpdate, setForceUpdate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let isMounted = true;
        apiClient
            .get<MobileVersionData>('/mobile/version')
            .then((data) => {
                if (!isMounted) return;
                setMinVersion(data.minVersion || '1.0.0');
                setLatestVersion(data.latestVersion || '1.0.0');
                setReleaseNotes(data.releaseNotes || '');
                setForceUpdate(Boolean(data.forceUpdate));
            })
            .catch((err: any) => {
                if (isMounted) {
                    toast.error(t('loadFailed'), {
                        description: err?.message || 'Server error',
                    });
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [t]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await apiClient.put('/mobile/version', {
                minVersion,
                latestVersion,
                releaseNotes,
                forceUpdate,
            });
            toast.success(t('updateSuccess'));
        } catch (err: any) {
            toast.error(t('updateFailed'), {
                description: err?.message || 'Access denied or validation error',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <TutorialProvider role="SUPER_ADMIN" screenId="sys_releases">
            <div className="space-y-6 p-6 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Smartphone className="w-6 h-6 text-primary" />
                            {t('title')}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t('subtitle')}
                        </p>
                    </div>
                    <HelpButton />
                </div>

                {/* Current Status Banner */}
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {t('liveTelemetry')}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl font-bold text-foreground">
                                        {t('latest')}: v{latestVersion}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        ({t('minSupported')}: v{minVersion})
                                    </span>
                                </div>
                            </div>
                            <Badge
                                tone={forceUpdate ? 'danger' : 'success'}
                                className="flex items-center gap-1.5 self-start sm:self-auto"
                            >
                                {forceUpdate ? (
                                    <>
                                        <AlertOctagon className="w-3.5 h-3.5" /> {t('forceUpdateActive')}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('softUpgradeMode')}
                                    </>
                                )}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Configuration Form */}
                <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">
                            {t('releaseParameters')}
                        </CardTitle>
                        <CardDescription>
                            {t('releaseParametersDesc')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground animate-pulse">
                                Loading release parameters...
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">
                                            Minimum Supported Version (SemVer) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            pattern="^\d+\.\d+\.\d+$"
                                            value={minVersion}
                                            onChange={(e) => setMinVersion(e.target.value)}
                                            placeholder="e.g. 1.0.0"
                                            className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Hard cutoff. Devices below this version cannot authenticate.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-foreground">
                                            Latest Production Version *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            pattern="^\d+\.\d+\.\d+$"
                                            value={latestVersion}
                                            onChange={(e) => setLatestVersion(e.target.value)}
                                            placeholder="e.g. 1.1.0"
                                            className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Latest published binary version in Google Play / TestFlight.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-foreground">
                                        Release Notes & Changelog
                                    </label>
                                    <textarea
                                        value={releaseNotes}
                                        onChange={(e) => setReleaseNotes(e.target.value)}
                                        rows={4}
                                        placeholder="Summary of bug fixes, new offline features, and performance enhancements..."
                                        className="w-full p-2.5 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="forceUpdateToggle"
                                            checked={forceUpdate}
                                            onChange={(e) => setForceUpdate(e.target.checked)}
                                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                                        />
                                        <label
                                            htmlFor="forceUpdateToggle"
                                            className="text-sm font-semibold text-foreground cursor-pointer"
                                        >
                                            Enforce Mandatory Update (Force Update)
                                        </label>
                                    </div>
                                    <p className="text-xs text-muted-foreground pl-6">
                                        When checked, the mobile app will render a non-dismissible modal preventing users from interacting with the app until updated.
                                    </p>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button
                                        type="submit"
                                        disabled={saving}
                                        className="flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        {saving ? t('saving') : t('deployButton')}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TutorialProvider>
    );
}
