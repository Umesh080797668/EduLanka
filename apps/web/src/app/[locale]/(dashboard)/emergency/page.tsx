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
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/api-client';
import { TutorialProvider } from '@/components/TutorialProvider';
import { HelpButton } from '@/components/HelpButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Layout';

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
  {
    name: 'Disaster Management Centre (DMC)',
    number: '117',
    desc: 'National 24/7 Emergency Operation Hotline',
  },
  { name: 'Police Emergency Response', number: '119', desc: 'Island-wide Rapid Police Dispatch' },
  {
    name: '1990 Suwaseriya Ambulance',
    number: '1990',
    desc: 'Free Pre-Hospital Emergency Medical Care',
  },
  {
    name: 'Child Protection Authority (NCPA)',
    number: '1989',
    desc: 'Childline Emergency Assistance',
  },
];

export default function StudentParentDisasterPackPage() {
  const t = useTranslations('DisasterMode');
  const [data, setData] = useState<DisasterPackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDisasterPack = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<DisasterPackData>('/mobile/disaster-pack', {
        skipGlobalToast: true,
      });
      setData(res || null);
    } catch {
      setError(t('loadErrorDesc'));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<DisasterPackData>('/mobile/disaster-pack', { skipGlobalToast: true })
      .then((res) => {
        if (isMounted) {
          setData(res || null);
          setError(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError(t('loadErrorDesc'));
          setData(null);
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
  }, [t]);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadDisasterPack();
  };

  const handlePrint = () => {
    window.print();
  };

  const contacts = data?.emergencyContacts ?? [];
  const shelters = data?.shelters ?? [];
  const isDisasterActive = Boolean(data?.disasterMode);

  return (
    <TutorialProvider role="STUDENT" screenId="disaster">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6" id="nav-emergency">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="bg-danger-500/10 text-danger-600 dark:text-danger-400 grid size-10 place-items-center rounded-xl">
                <ShieldAlert className="size-6" />
              </div>
              <div>
                <h1 className="text-display-sm text-neutral-900 dark:text-neutral-50">
                  {t('packTitle')}
                </h1>
                <p className="text-muted-foreground text-sm">{t('packSubtitle')}</p>
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
              {t('refresh')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="size-4" />
              {t('printPack')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16">
            <RefreshCw className="text-primary size-8 animate-spin" />
            <p className="text-sm font-medium">{t('loadingReadiness')}</p>
          </div>
        ) : error && !data ? (
          <EmptyState
            icon={<AlertTriangle className="text-danger-500 size-8" />}
            title={t('loadErrorTitle')}
            description={error}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => void loadDisasterPack()}
                leadingIcon={<RefreshCw />}
              >
                {t('retry')}
              </Button>
            }
          />
        ) : (
          <>
            {/* ── Active Disaster Alert Banner ─────────────────────────────────── */}
            {isDisasterActive ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-card border-danger-500/30 bg-danger-50/70 dark:bg-danger-950/30 border-2 p-5 shadow-sm"
              >
                <div className="flex items-start gap-3.5">
                  <div className="bg-danger-600 grid size-9 shrink-0 place-items-center rounded-lg text-white">
                    <AlertTriangle className="size-5 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-danger-900 dark:text-danger-200 text-base font-bold">
                        {t('activeAlertTitle', {
                          reason: data?.disasterReason || t('defaultDisasterReason'),
                        })}
                      </h3>
                      <Badge tone="danger">{t('activeBadge')}</Badge>
                    </div>
                    <p className="text-danger-800 dark:text-danger-300 text-sm">
                      {t('activeAlertNotice')}
                    </p>
                    {data?.expectedResumeDate && (
                      <p className="text-danger-900 dark:text-danger-100 pt-1 text-xs font-semibold">
                        {t('reopeningDate', {
                          date: new Date(data.expectedResumeDate).toLocaleDateString(),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-card border-success-500/20 bg-success-50/50 dark:bg-success-950/20 flex items-center justify-between border p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-success-500 size-2.5 rounded-full" />
                  <span className="text-success-900 dark:text-success-200 text-sm font-medium">
                    {t('operationalStatus')}
                  </span>
                </div>
                <Badge tone="success">{t('operationalBadge')}</Badge>
              </div>
            )}

            {/* ── National Hotlines ────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Phone className="text-brand-600 dark:text-brand-400 size-4" />
                  {t('hotlinesTitle')}
                </CardTitle>
                <CardDescription>{t('hotlinesDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {NATIONAL_HOTLINES.map((h) => (
                    <div
                      key={h.number}
                      className="rounded-card border-border/70 bg-card hover:border-brand-500/40 flex flex-col justify-between border p-3.5 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-brand-700 dark:text-brand-300 text-2xl font-black tracking-tight">
                            {h.number}
                          </span>
                          <Badge tone="neutral" className="text-[10px]">
                            {t('tollFree')}
                          </Badge>
                        </div>
                        <p className="text-foreground mt-1 text-xs font-semibold">{h.name}</p>
                        <p className="text-muted-foreground mt-0.5 text-[11px]">{h.desc}</p>
                      </div>
                      <a
                        href={`tel:${h.number}`}
                        className="rounded-input bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900 text-brand-700 dark:text-brand-200 mt-3 inline-flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-semibold transition-colors"
                      >
                        <Phone className="size-3" />
                        {t('callNumber', { number: h.number })}
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── School Contacts & Evacuation Shelters ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* School Emergency Contacts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Users className="text-primary size-4" />
                    {t('schoolOfficersTitle')}
                  </CardTitle>
                  <CardDescription>{t('schoolOfficersDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contacts.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      {t('noCoordinators')}
                    </p>
                  ) : (
                    contacts.map((c, i) => (
                      <div
                        key={c.id || i}
                        className="rounded-card border-border/70 bg-muted/30 flex items-center justify-between border p-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-sm font-semibold">{c.name}</span>
                            {Boolean(c.isPrimary || c.is_primary) && (
                              <Badge tone="primary" className="text-[10px]">
                                {t('primaryLead')}
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground text-xs">{c.role}</span>
                        </div>
                        <a
                          href={`tel:${c.phone}`}
                          className="rounded-input bg-primary/10 hover:bg-primary/20 text-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
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
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Home className="text-primary size-4" />
                    {t('sheltersSectionTitle')}
                  </CardTitle>
                  <CardDescription>{t('sheltersSectionDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {shelters.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      {t('noShelters')}
                    </p>
                  ) : (
                    shelters.map((s, i) => (
                      <div
                        key={s.id || i}
                        className="rounded-card border-border/70 bg-muted/30 space-y-1.5 border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-foreground text-sm font-semibold">{s.name}</span>
                          {s.capacity && (
                            <Badge tone="neutral" className="text-[10px]">
                              {t('shelterCapacity', { capacity: s.capacity })}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <MapPin className="size-3.5 shrink-0" />
                          <span>{s.address}</span>
                        </div>
                        {s.notes && (
                          <p className="text-muted-foreground text-[11px] italic">{s.notes}</p>
                        )}
                        {s.gps_lat && s.gps_lng && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${s.gps_lat},${s.gps_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 pt-1 text-[11px] font-medium hover:underline"
                          >
                            <Navigation className="size-3" />
                            {t('openInMaps')}
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Offline Mobile Integration Notice ───────────────────────────── */}
            <Card className="border-brand-500/20 bg-brand-50/30 dark:bg-brand-950/20 border">
              <CardContent className="flex flex-col items-center justify-between gap-4 p-5 sm:flex-row">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-foreground text-sm font-bold">{t('offlineSyncTitle')}</h4>
                  <p className="text-muted-foreground max-w-xl text-xs">{t('offlineSyncDesc')}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePrint}
                  className="shrink-0 gap-2"
                >
                  <Download className="size-4" />
                  {t('savePrintable')}
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
