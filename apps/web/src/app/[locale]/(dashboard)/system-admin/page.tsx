'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BookOpenCheck,
  Building2,
  Network,
  PiggyBank,
  RadioTower,
  RefreshCw,
  Send,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { apiClient } from '@/lib/api-client';
import { useRealtimeTelemetry } from '@/hooks/useRealtimeTelemetry';
import { HelpButton } from '@/components/HelpButton';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';
import { DashboardCardsSkeleton } from '@/components/ui/Skeleton';
import { Progress, StatCard } from '@/components/ui/Stat';

/** Console shortcuts rendered inside the hero. `id` doubles as a tour anchor. */
const QUICK_LINKS = [
  { href: '/system-admin/tenants', icon: Building2, key: 'quickTenants', id: 'nav-tenants' },
  { href: '/system-admin/users', icon: Users, key: 'quickUsers', id: 'nav-users' },
  { href: '/system-admin/audit-logs', icon: Shield, key: 'quickAudit', id: 'nav-audit' },
  { href: '/system-admin/sponsorships', icon: PiggyBank, key: 'quickSponsorships', id: 'nav-sponsorships' },
] as const;

interface TutorialStat {
  role?: string;
  eligible: number;
  completed: number;
  skipped: number;
}

export default function SystemAdminDashboard() {
  const t = useTranslations('SystemAdminDashboard');
  const { activeUsers } = useRealtimeTelemetry();
  const [stats, setStats] = useState<any>(null);
  const [tutorialStats, setTutorialStats] = useState<Record<string, TutorialStat> | null>(null);
  const [observabilityStats, setObservabilityStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Kept separate from `loading` so dispatching a broadcast never blanks the page.
  const [sending, setSending] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [res, tutRes, obsRes] = await Promise.all([
        apiClient.get<any>('/tenants/stats'),
        apiClient.get<any>('/system-admin/tutorials/stats'),
        apiClient
          .get<any>('/system-admin/observability/metrics', {
            skipGlobalToast: true,
          })
          .catch(() => null),
      ]);

      setStats(res);
      setTutorialStats(tutRes);
      setObservabilityStats(obsRes);
    } catch (e: any) {
      console.error(e);
      setFetchError(e?.message || 'Failed to load system metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleBroadcast = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSending(true);
    try {
      const res = await apiClient.post<any>('/notices/broadcast', {
        title: formData.get('title') as string,
        content: formData.get('content') as string,
        send_sms: formData.get('send_sms') === 'on',
      });
      toast.success(t('broadcastSuccess'), {
        description: t('broadcastSuccessDesc', { count: res?.dispatches ?? 0 }),
      });
      form.reset();
    } catch (err: any) {
      toast.error(t('broadcastFailure'), { description: err.message });
    } finally {
      setSending(false);
    }
  };

  const tutorials: TutorialStat[] = Array.isArray(tutorialStats)
    ? tutorialStats
    : Array.isArray((tutorialStats as any)?.data)
      ? (tutorialStats as any).data
      : Object.values(tutorialStats ?? {});
  const totalCompleted = tutorials.reduce((sum, s) => sum + (s.completed ?? 0), 0);
  const totalSkipped = tutorials.reduce((sum, s) => sum + (s.skipped ?? 0), 0);
  const healthy = stats?.status === 'Healthy';

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardCardsSkeleton />
      </div>
    );
  }

  if (fetchError && !stats) {
    return (
      <div className="mx-auto max-w-6xl py-12">
        <EmptyState
          icon={<Server className="text-danger-500 size-8" />}
          title={t('noData')}
          description={fetchError}
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => void fetchStats()}
              leadingIcon={<RefreshCw className="size-4" />}
            >
              {t('retry') || 'Retry'}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <TutorialProvider role="SUPER_ADMIN" screenId="dashboard">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-card from-brand-800 to-brand-950 shadow-card relative isolate overflow-hidden bg-gradient-to-br p-6 text-white sm:p-8"
          id="nav-dashboard"
        >
          <div
            aria-hidden
            className="bg-brand-400/25 pointer-events-none absolute -top-32 -right-20 size-80 rounded-full blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-10 size-48 rounded-full bg-white/10 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-bold tracking-[0.18em] text-white/60 uppercase">
                {t('consoleEyebrow')}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-white/15 ring-1 ring-white/20 ring-inset">
                  <Server className="size-5" aria-hidden />
                </span>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/75">{t('subtitle')}</p>
            </div>

            <nav className="flex flex-wrap gap-2">
              {QUICK_LINKS.map(({ href, icon: Icon, key, id }) => (
                <Link
                  key={href}
                  id={id}
                  href={href}
                  className="rounded-pill inline-flex items-center gap-2 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors ring-inset hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Icon className="size-4" aria-hidden />
                  {t(key)}
                </Link>
              ))}
            </nav>
          </div>
        </motion.section>

        {/* ── Telemetry ─────────────────────────────────────────────────── */}
        <motion.div
          id="nav-infrastructure"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            label={t('systemStatus')}
            value={healthy ? t('healthy') : t('active')}
            icon={<Activity />}
            tone={healthy ? 'success' : 'warning'}
            hint={
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`size-2 animate-pulse rounded-full ${healthy ? 'bg-success' : 'bg-warning'}`}
                />
                {stats?.status ?? '—'}
              </span>
            }
          />

          <StatCard
            label={t('overallCompletions')}
            value={totalCompleted}
            icon={<BookOpenCheck />}
            tone="primary"
            hint={`${totalSkipped} ${t('skippedLower')}`}
          />

          <StatCard
            label={t('presenceTitle')}
            value={activeUsers}
            icon={<Users />}
            tone="info"
            hint={t('activeInstances')}
          />

          <StatCard
            label={t('socketsTitle')}
            value={
              observabilityStats
                ? (observabilityStats.websockets?.active_connections ?? 0)
                : t('offline')
            }
            icon={<Network />}
            tone={observabilityStats ? 'success' : 'neutral'}
            hint={
              observabilityStats
                ? `${observabilityStats.websockets?.chat_connections ?? 0} chat · ${observabilityStats.websockets?.notification_connections ?? 0} notif`
                : t('healthDesc')
            }
          />
        </motion.div>

        {/* ── Observability & Gateway Metrics ────────────────────────────── */}
        {observabilityStats && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="grid gap-4 md:grid-cols-2"
          >
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle as="h2" className="flex items-center gap-2 text-base">
                    <Network className="text-brand-600 dark:text-brand-400 size-4" />
                    {t('socketGatewayDetail')}
                  </CardTitle>
                  <p className="text-muted-foreground mt-0.5 text-xs">{t('observabilityDesc')}</p>
                </div>
                <Badge
                  tone={
                    (observabilityStats.websockets?.error_count ?? 0) > 0 ? 'danger' : 'success'
                  }
                  variant="soft"
                  size="sm"
                >
                  {(observabilityStats.websockets?.error_count ?? 0) > 0
                    ? `${observabilityStats.websockets?.error_count} ${t('socketErrors')}`
                    : t('allGatewaysHealthy')}
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="border-border/60 bg-muted/30 grid grid-cols-3 gap-3 rounded-lg border p-3 text-center">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('chatSockets')}</p>
                    <p className="text-foreground mt-1 text-xl font-bold tracking-tight">
                      {observabilityStats.websockets?.chat_connections ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">
                      {t('notificationSockets')}
                    </p>
                    <p className="text-foreground mt-1 text-xl font-bold tracking-tight">
                      {observabilityStats.websockets?.notification_connections ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('socketErrors')}</p>
                    <p
                      className={`mt-1 text-xl font-bold tracking-tight ${(observabilityStats.websockets?.error_count ?? 0) > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-foreground'}`}
                    >
                      {observabilityStats.websockets?.error_count ?? 0}
                    </p>
                  </div>
                </div>
                <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Activity className="text-success size-3.5" />
                    {t('uptime')}:
                  </span>
                  <span className="text-foreground font-mono font-medium">
                    {observabilityStats.uptime_seconds
                      ? t('uptimeFormat', {
                        hours: Math.floor(observabilityStats.uptime_seconds / 3600),
                        minutes: Math.floor((observabilityStats.uptime_seconds % 3600) / 60),
                        seconds: Math.floor(observabilityStats.uptime_seconds % 60),
                      })
                      : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle as="h2" className="flex items-center gap-2 text-base">
                    <RadioTower className="text-accent-600 dark:text-accent-400 size-4" />
                    {t('smsQueueTitle')}
                  </CardTitle>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    BullMQ queue workers and asynchronous SMS dispatches.
                  </p>
                </div>
                <Badge tone="info" variant="soft" size="sm">
                  BullMQ
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="border-border/60 bg-muted/30 grid grid-cols-4 gap-2 rounded-lg border p-3 text-center">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('smsWaiting')}</p>
                    <p className="text-foreground mt-1 text-lg font-bold tracking-tight">
                      {observabilityStats.sms_queue?.waiting ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('smsActive')}</p>
                    <p className="text-brand-600 dark:text-brand-400 mt-1 text-lg font-bold tracking-tight">
                      {observabilityStats.sms_queue?.active ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('smsCompleted')}</p>
                    <p className="text-success-600 dark:text-success-400 mt-1 text-lg font-bold tracking-tight">
                      {observabilityStats.sms_queue?.completed ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">{t('smsFailed')}</p>
                    <p
                      className={`mt-1 text-lg font-bold tracking-tight ${(observabilityStats.sms_queue?.failed ?? 0) > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-foreground'}`}
                    >
                      {observabilityStats.sms_queue?.failed ?? 0}
                    </p>
                  </div>
                </div>
                <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                  <span>Delayed / Retrying:</span>
                  <span className="text-foreground font-mono font-medium">
                    {observabilityStats.sms_queue?.delayed ?? 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Adoption analytics ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <BookOpenCheck className="text-muted-foreground size-[18px]" aria-hidden />
                {t('adoptionAnalytics')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tutorials.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<BookOpenCheck />}
                  title={t('noData')}
                  description={t('analyticsMoved')}
                />
              ) : (
                <>
                  <p className="text-muted-foreground mb-5 text-sm">{t('analyticsMoved')}</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {tutorials.map((tut, idx) => {
                      const pct =
                        tut.eligible > 0 ? Math.round((tut.completed / tut.eligible) * 100) : 0;
                      return (
                        <motion.div
                          key={tut.role ?? idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: Math.min(idx * 0.04, 0.3),
                          }}
                          className="rounded-card border-border bg-muted/40 border p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <h3 className="text-foreground text-sm leading-tight font-bold capitalize">
                              {tut.role?.toLowerCase().replace(/_/g, ' ') ?? t('global')}
                            </h3>
                            <Badge
                              tone={pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'neutral'}
                              size="sm"
                            >
                              {pct}%
                            </Badge>
                          </div>

                          <Progress
                            value={pct}
                            size="sm"
                            tone={pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'primary'}
                          />

                          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                            {[
                              {
                                label: t('completedLower'),
                                value: tut.completed,
                              },
                              {
                                label: t('eligibleLower'),
                                value: tut.eligible,
                              },
                              {
                                label: t('skippedLower'),
                                value: tut.skipped,
                              },
                            ].map((cell) => (
                              <div key={cell.label}>
                                <dd className="numeric text-foreground text-base font-bold">
                                  {cell.value ?? 0}
                                </dd>
                                <dt className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                                  {cell.label}
                                </dt>
                              </div>
                            ))}
                          </dl>
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Global broadcast ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <RadioTower className="text-muted-foreground size-[18px]" aria-hidden />
                {t('broadcastTitle')}
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">{t('broadcastDesc')}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBroadcast} className="max-w-2xl space-y-4">
                <Field label={t('broadcastAlertTitle')} required htmlFor="bc-title">
                  <Input
                    id="bc-title"
                    name="title"
                    required
                    maxLength={140}
                    placeholder={t('broadcastTitlePlaceholder')}
                  />
                </Field>

                <Field label={t('broadcastContent')} required htmlFor="bc-content">
                  <Textarea
                    id="bc-content"
                    name="content"
                    required
                    rows={4}
                    placeholder={t('broadcastContentPlaceholder')}
                  />
                </Field>

                <div className="rounded-card border-border bg-destructive-subtle ring-destructive/20 border p-4 ring-1 ring-inset">
                  <Checkbox
                    id="send_sms"
                    name="send_sms"
                    label={t('broadcastSmsOverride')}
                    hint={t('broadcastSmsOverrideHint')}
                  />
                </div>

                <Button type="submit" loading={sending} leadingIcon={<Send />}>
                  {sending ? t('dispatching') : t('dispatchBroadcast')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <HelpButton />
      </div>
    </TutorialProvider>
  );
}
