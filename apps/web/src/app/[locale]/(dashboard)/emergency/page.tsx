'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    Download,
    Home,
    MapPin,
    Navigation,
    Phone,
    Printer,
    RefreshCw,
    ShieldAlert,
    Users,
} from 'lucide-react';

import { apiClient } from '@/lib/api-client';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface EmergencyContact {
    id?: string;
    name: string;
    role: string;
    phone: string;
    isPrimary?: boolean;
    is_primary?: boolean | number;
}

interface Shelter {
    id?: string;
    name: string;
    address: string;
    capacity?: number;
    gps_lat?: number;
    gps_lng?: number;
    contact_phone?: string;
    notes?: string;
}

interface DisasterPackData {
    tenantName?: string;
    disasterMode?: boolean;
    disasterReason?: string | null;
    expectedResumeDate?: string | null;
    emergencyContacts?: EmergencyContact[];
    shelters?: Shelter[];
    offlineCirculars?: Array<{ id: string; title: string; published_at?: string }>;
    learningResources?: Array<{ name: string; url: string; format: string }>;
}

const NATIONAL_HOTLINES = [
    { name: 'Disaster Management Centre (DMC)', number: '117', desc: 'National 24/7 Emergency Operation Hotline' },
    { name: 'Police Emergency Response', number: '119', desc: 'Island-wide Rapid Police Dispatch' },
    { name: '1990 Suwaseriya Ambulance', number: '1990', desc: 'Free Pre-Hospital Emergency Medical Care' },
    { name: 'Child Protection Authority (NCPA)', number: '1989', desc: 'Childline Emergency Assistance' },
];

export default function StudentParentDisasterPackPage() {
    const [data, setData] = useState<DisasterPackData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadDisasterPack = useCallback(async () => {
        try {
            const res = await apiClient.get<DisasterPackData>('/mobile/disaster-pack', {
                skipGlobalToast: true,
            });
            setData(res);
        } catch {
            // Safe fallback data
            setData({
                tenantName: 'EduLanka School Community',
                disasterMode: false,
                emergencyContacts: [
                    { name: 'School Emergency Coordinator', role: 'Campus Readiness Lead', phone: '0112345678', isPrimary: true },
                    { name: 'Principal Office Direct Line', role: 'Administration', phone: '0112345679', isPrimary: true },
                ],
                shelters: [],
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        apiClient
            .get<DisasterPackData>('/mobile/disaster-pack', { skipGlobalToast: true })
            .then((res) => {
                if (isMounted && res) setData(res);
            })
            .catch(() => {
                if (isMounted) {
                    setData({
                        tenantName: 'EduLanka School Community',
                        disasterMode: false,
                        emergencyContacts: [
                            { name: 'School Emergency Coordinator', role: 'Campus Readiness Lead', phone: '0112345678', isPrimary: true },
                            { name: 'Principal Office Direct Line', role: 'Administration', phone: '0112345679', isPrimary: true },
                        ],
                        shelters: [],
                    });
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                    setRefreshing(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        loadDisasterPack();
    };

    const handlePrint = () => {
        window.print();
    };

    const contacts = data?.emergencyContacts ?? [];
    const shelters = data?.shelters ?? [];
    const isDisasterActive = Boolean(data?.disasterMode);

    return (
        <TutorialProvider role="STUDENT" screenId="disaster">
            <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" id="nav-emergency">
                {/* ── Header ──────────────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="grid size-10 place-items-center rounded-xl bg-danger-500/10 text-danger-600 dark:text-danger-400">
                                <ShieldAlert className="size-6" />
                            </div>
                            <div>
                                <h1 className="text-display-sm text-neutral-900 dark:text-neutral-50">
                                    School Disaster & Emergency Pack
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Essential emergency hotlines, shelter map locations, and contingency plans for students and parents.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="gap-2"
                        >
                            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handlePrint}
                            className="gap-2"
                        >
                            <Printer className="size-4" />
                            Print Pack
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <RefreshCw className="size-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Loading emergency readiness data...</p>
                    </div>
                ) : (
                    <>
                        {/* ── Active Disaster Alert Banner ─────────────────────────────────── */}
                        {isDisasterActive ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="rounded-card border-2 border-danger-500/30 bg-danger-50/70 dark:bg-danger-950/30 p-5 shadow-sm"
                            >
                                <div className="flex items-start gap-3.5">
                                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-danger-600 text-white">
                                        <AlertTriangle className="size-5 animate-pulse" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-danger-900 dark:text-danger-200">
                                                Active Campus Disaster Alert: {data?.disasterReason || 'Campus Closed Due to Extreme Weather'}
                                            </h3>
                                            <Badge tone="danger">Active Alert</Badge>
                                        </div>
                                        <p className="text-sm text-danger-800 dark:text-danger-300">
                                            Normal campus classes are suspended. Follow localized safety orders. Offline self-study learning packs and past papers are pre-downloaded on student mobile devices.
                                        </p>
                                        {data?.expectedResumeDate && (
                                            <p className="text-xs font-semibold text-danger-900 dark:text-danger-100 pt-1">
                                                Tentative Campus Reopening Date: {new Date(data.expectedResumeDate).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="rounded-card border border-success-500/20 bg-success-50/50 dark:bg-success-950/20 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-2.5 rounded-full bg-success-500" />
                                    <span className="text-sm font-medium text-success-900 dark:text-success-200">
                                        Normal Campus Status: School is in session. Readiness protocols active.
                                    </span>
                                </div>
                                <Badge tone="success">Operational</Badge>
                            </div>
                        )}

                        {/* ── National Hotlines ────────────────────────────────────────────── */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Phone className="size-4 text-brand-600 dark:text-brand-400" />
                                    National Emergency Dispatch Hotlines
                                </CardTitle>
                                <CardDescription>
                                    Toll-free emergency numbers accessible 24 hours a day from any Sri Lankan mobile or fixed network.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {NATIONAL_HOTLINES.map((h) => (
                                        <div
                                            key={h.number}
                                            className="p-3.5 rounded-card border border-border/70 bg-card hover:border-brand-500/40 transition-colors flex flex-col justify-between"
                                        >
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl font-black text-brand-700 dark:text-brand-300 tracking-tight">
                                                        {h.number}
                                                    </span>
                                                    <Badge tone="neutral" className="text-[10px]">Toll-Free</Badge>
                                                </div>
                                                <p className="mt-1 font-semibold text-xs text-foreground">
                                                    {h.name}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {h.desc}
                                                </p>
                                            </div>
                                            <a
                                                href={`tel:${h.number}`}
                                                className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-semibold rounded-input bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900 text-brand-700 dark:text-brand-200 transition-colors"
                                            >
                                                <Phone className="size-3" />
                                                Call {h.number}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── School Contacts & Evacuation Shelters ─────────────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* School Emergency Contacts */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Users className="size-4 text-primary" />
                                        School Emergency Officers
                                    </CardTitle>
                                    <CardDescription>
                                        Verified point-of-contact staff designated for disaster coordination.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {contacts.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-4 text-center">
                                            No school coordinators configured.
                                        </p>
                                    ) : (
                                        contacts.map((c, i) => (
                                            <div
                                                key={c.id || i}
                                                className="flex items-center justify-between p-3 rounded-card border border-border/70 bg-muted/30"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm text-foreground">
                                                            {c.name}
                                                        </span>
                                                        {Boolean(c.isPrimary || c.is_primary) && (
                                                            <Badge tone="primary" className="text-[10px]">Primary Lead</Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {c.role}
                                                    </span>
                                                </div>
                                                <a
                                                    href={`tel:${c.phone}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors"
                                                >
                                                    <Phone className="size-3.5" />
                                                    {c.phone}
                                                </a>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            {/* Local Evacuation Shelters */}
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Home className="size-4 text-primary" />
                                        Evacuation Shelters & Relief Centres
                                    </CardTitle>
                                    <CardDescription>
                                        Pre-assigned government, temple, and school safe zones during natural disasters.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {shelters.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-4 text-center">
                                            No evacuation shelters registered yet for this area.
                                        </p>
                                    ) : (
                                        shelters.map((s, i) => (
                                            <div
                                                key={s.id || i}
                                                className="p-3 rounded-card border border-border/70 bg-muted/30 space-y-1.5"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="font-semibold text-sm text-foreground">
                                                        {s.name}
                                                    </span>
                                                    {s.capacity && (
                                                        <Badge tone="neutral" className="text-[10px]">
                                                            Cap: {s.capacity} persons
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <MapPin className="size-3.5 shrink-0" />
                                                    <span>{s.address}</span>
                                                </div>
                                                {s.notes && (
                                                    <p className="text-[11px] text-muted-foreground italic">
                                                        {s.notes}
                                                    </p>
                                                )}
                                                {s.gps_lat && s.gps_lng && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${s.gps_lat},${s.gps_lng}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium pt-1"
                                                    >
                                                        <Navigation className="size-3" />
                                                        Open in Google Maps Directions
                                                    </a>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* ── Offline Mobile Integration Notice ───────────────────────────── */}
                        <Card className="border border-brand-500/20 bg-brand-50/30 dark:bg-brand-950/20">
                            <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="space-y-1 text-center sm:text-left">
                                    <h4 className="text-sm font-bold text-foreground">
                                        Offline SQLCipher Sync on EduLanka Mobile
                                    </h4>
                                    <p className="text-xs text-muted-foreground max-w-xl">
                                        This emergency directory, along with past papers, study documents, and offline learning videos, automatically syncs to your phone whenever you are online. During monsoon floods or connectivity blackouts, the entire pack remains available offline without an active internet connection.
                                    </p>
                                </div>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handlePrint}
                                    className="shrink-0 gap-2"
                                >
                                    <Download className="size-4" />
                                    Save Printable Copy
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
                <HelpButton />
            </div>
        </TutorialProvider>
    );
}
