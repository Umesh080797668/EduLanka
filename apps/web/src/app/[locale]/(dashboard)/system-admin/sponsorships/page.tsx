'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  Ban,
  Calendar,
  CircleDollarSign,
  GiftIcon,
  Loader2,
  PiggyBank,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, Field, Textarea } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/Layout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SponsorshipPool {
  id: string;
  period_month: string;
  net_profit_lkr: number;
  pool_fraction: number;
  pool_amount_lkr: number;
  remaining_lkr: number;
  created_at: string;
}

interface SponsoredGrant {
  id: string;
  pool_id: string | null;
  beneficiary_type: 'SCHOOL' | 'INDEPENDENT_LEARNER';
  beneficiary_id: string;
  from_plan: string;
  to_plan: string;
  granted_at: string;
  expires_at: string;
  is_active: boolean;
  estimated_cost_lkr: number;
  notes: string | null;
}

type Tab = 'pools' | 'grants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtLkr(v: number) {
  return `LKR ${(v ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

// ─── Award Grant Modal ────────────────────────────────────────────────────────

function AwardGrantModal({
  pools,
  onClose,
  onAwarded,
}: {
  pools: SponsorshipPool[];
  onClose: () => void;
  onAwarded: () => void;
}) {
  const [form, setForm] = useState({
    beneficiaryType: 'INDEPENDENT_LEARNER' as 'SCHOOL' | 'INDEPENDENT_LEARNER',
    beneficiaryId: '',
    fromPlan: 'FREE_INDIVIDUAL',
    toPlan: 'INDIVIDUAL_PRO',
    expiresAt: '',
    poolId: '',
    estimatedCostLkr: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.beneficiaryId.trim() || !form.expiresAt) {
      toast.error('Beneficiary ID and expiry date are required');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/billing/sponsorship/grants', {
        ...form,
        estimatedCostLkr: form.estimatedCostLkr ? Number(form.estimatedCostLkr) : 0,
        poolId: form.poolId || undefined,
      });
      toast.success('Grant awarded successfully');
      onAwarded();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to award grant');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <GiftIcon className="w-5 h-5 text-indigo-400" />
          Award Sponsorship Grant
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Beneficiary Type">
            <select
              id="beneficiaryType"
              value={form.beneficiaryType}
              onChange={(e) => set('beneficiaryType', e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="INDEPENDENT_LEARNER">Independent Learner</option>
              <option value="SCHOOL">School (Tenant)</option>
            </select>
          </Field>
          <Field label="Beneficiary ID (independent_learners.id or tenant UUID)">
            <Input
              id="beneficiaryId"
              placeholder="UUID of the beneficiary"
              value={form.beneficiaryId}
              onChange={(e) => set('beneficiaryId', e.target.value)}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Plan">
              <Input
                id="fromPlan"
                value={form.fromPlan}
                onChange={(e) => set('fromPlan', e.target.value)}
                placeholder="FREE_INDIVIDUAL"
              />
            </Field>
            <Field label="To Plan">
              <Input
                id="toPlan"
                value={form.toPlan}
                onChange={(e) => set('toPlan', e.target.value)}
                placeholder="INDIVIDUAL_PRO"
              />
            </Field>
          </div>
          <Field label="Expires At">
            <Input
              id="expiresAt"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => set('expiresAt', e.target.value)}
              required
            />
          </Field>
          <Field label="Pool (optional)">
            <select
              id="poolId"
              value={form.poolId}
              onChange={(e) => set('poolId', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">— No pool deduction —</option>
              {pools
                .filter((p) => p.remaining_lkr > 0)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.period_month).toLocaleString('en-LK', { year: 'numeric', month: 'long' })} — {fmtLkr(p.remaining_lkr)} remaining
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Estimated Cost (LKR)">
            <Input
              id="estimatedCostLkr"
              type="number"
              min={0}
              placeholder="0.00"
              value={form.estimatedCostLkr}
              onChange={(e) => set('estimatedCostLkr', e.target.value)}
            />
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              id="notes"
              rows={2}
              placeholder="Reason for awarding..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Award className="w-4 h-4 mr-2" />}
              Award Grant
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 border border-white/10">
              Cancel
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SponsorshipsPage() {
  const [tab, setTab] = useState<Tab>('pools');
  const [pools, setPools] = useState<SponsorshipPool[]>([]);
  const [grants, setGrants] = useState<SponsoredGrant[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Pool Calculator state
  const [calcMonth, setCalcMonth] = useState(new Date().toISOString().slice(0, 7));
  const [calcProfit, setCalcProfit] = useState('');
  const [calcLoading, setCalcLoading] = useState(false);

  const fetchPools = useCallback(async () => {
    setLoadingPools(true);
    try {
      const data = await apiClient.get<any[]>('/billing/sponsorship/pools');
      setPools(data ?? []);
    } catch {
      toast.error('Failed to load sponsorship pools');
    } finally {
      setLoadingPools(false);
    }
  }, []);

  const fetchGrants = useCallback(async () => {
    setLoadingGrants(true);
    try {
      const data = await apiClient.get<any[]>(`/billing/sponsorship/grants?activeOnly=${activeOnly}`);
      setGrants(data ?? []);
    } catch {
      toast.error('Failed to load grants');
    } finally {
      setLoadingGrants(false);
    }
  }, [activeOnly]);

  useEffect(() => { fetchPools(); }, [fetchPools]);
  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  async function handleCalculatePool() {
    if (!calcProfit || isNaN(Number(calcProfit))) {
      toast.error('Enter a valid net profit amount');
      return;
    }
    setCalcLoading(true);
    try {
      const result = await apiClient.post<any>('/billing/sponsorship/pools/calculate', {
        billingMonth: calcMonth,
        netProfitLkr: Number(calcProfit),
      });
      toast.success(`Pool calculated: ${fmtLkr(result.pool_amount_lkr)} allocated`);
      fetchPools();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to calculate pool');
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleRevokeGrant(grantId: string) {
    if (!confirm('Revoke this grant? This will deactivate it and restore pool balance.')) return;
    setRevoking(grantId);
    try {
      await apiClient.post(`/billing/sponsorship/grants/${grantId}/revoke`, {
        reason: 'Manual revocation via Super Admin console',
      });
      toast.success('Grant revoked');
      fetchGrants();
      fetchPools();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke grant');
    } finally {
      setRevoking(null);
    }
  }

  // Summary stats
  const totalPool = pools.reduce((s, p) => s + p.pool_amount_lkr, 0);
  const totalRemaining = pools.reduce((s, p) => s + p.remaining_lkr, 0);
  const activeGrants = grants.filter((g) => g.is_active && !isExpired(g.expires_at)).length;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white px-4 py-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-indigo-400" />
            Sponsored Growth
          </h1>
          <p className="text-white/50 text-sm mt-1">
            Manage sponsorship pools (10% of monthly net profit) and individual grants.
          </p>
        </div>
        <Button
          id="btn-award-grant"
          onClick={() => setShowAwardModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2"
        >
          <GiftIcon className="w-4 h-4" />
          Award Grant
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Pool Allocated', value: fmtLkr(totalPool), icon: TrendingUp, color: 'text-emerald-400' },
          { label: 'Pool Remaining', value: fmtLkr(totalRemaining), icon: CircleDollarSign, color: 'text-blue-400' },
          { label: 'Active Grants', value: String(activeGrants), icon: Award, color: 'text-indigo-400' },
        ].map((s) => (
          <Card key={s.label} className="bg-[#1a1f2e] border border-white/10">
            <CardContent className="pt-5 pb-4 flex items-center gap-4">
              <s.icon className={`w-8 h-8 ${s.color}`} />
              <div>
                <p className="text-white/50 text-xs">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calculate Pool */}
      <Card className="bg-[#1a1f2e] border border-white/10">
        <CardHeader>
          <CardTitle className="text-sm text-white/70 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calculate Monthly Pool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Billing Month" className="flex-1 min-w-[140px]">
              <Input
                id="calcMonth"
                type="month"
                value={calcMonth}
                onChange={(e) => setCalcMonth(e.target.value)}
              />
            </Field>
            <Field label="Net Profit (LKR)" className="flex-1 min-w-[180px]">
              <Input
                id="calcProfit"
                type="number"
                min={0}
                placeholder="e.g. 500000"
                value={calcProfit}
                onChange={(e) => setCalcProfit(e.target.value)}
              />
            </Field>
            <Button
              id="btn-calc-pool"
              onClick={handleCalculatePool}
              disabled={calcLoading}
              className="bg-emerald-700 hover:bg-emerald-600 mb-0"
            >
              {calcLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calculate 10%'}
            </Button>
          </div>
          <p className="text-white/30 text-xs mt-2">
            This upserts a sponsorship pool row for the selected month. Re-running on an existing month updates remaining balance proportionally.
          </p>
        </CardContent>
      </Card>

      {/* Tab Nav */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(['pools', 'grants'] as Tab[]).map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${tab === t
              ? 'border-indigo-400 text-white'
              : 'border-transparent text-white/40 hover:text-white/70'
              }`}
          >
            {t === 'pools' ? 'Sponsorship Pools' : 'Grants'}
          </button>
        ))}
      </div>

      {/* Pools Tab */}
      {tab === 'pools' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              id="btn-refresh-pools"
              variant="ghost"
              onClick={fetchPools}
              disabled={loadingPools}
              className="text-white/50 hover:text-white flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingPools ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          {loadingPools ? (
            <div className="text-white/40 text-center py-16">Loading pools…</div>
          ) : pools.length === 0 ? (
            <EmptyState
              title="No pools yet"
              description="Use the calculator above to create the first monthly sponsorship pool."
            />
          ) : (
            pools.map((pool) => (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1a1f2e] border border-white/10 rounded-xl px-5 py-4 flex flex-wrap items-center gap-6 justify-between"
              >
                <div>
                  <p className="font-semibold text-white">
                    {new Date(pool.period_month).toLocaleString('en-LK', { year: 'numeric', month: 'long' })}
                  </p>
                  <p className="text-white/50 text-xs">Net profit: {fmtLkr(pool.net_profit_lkr)}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold">{fmtLkr(pool.pool_amount_lkr)} allocated</p>
                  <p className="text-white/50 text-xs">{fmtLkr(pool.remaining_lkr)} remaining</p>
                </div>
                <div className="w-full">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{
                        width: pool.pool_amount_lkr > 0
                          ? `${Math.min(100, ((pool.pool_amount_lkr - pool.remaining_lkr) / pool.pool_amount_lkr) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <p className="text-white/30 text-xs mt-1">
                    {pool.pool_amount_lkr > 0
                      ? `${Math.round(((pool.pool_amount_lkr - pool.remaining_lkr) / pool.pool_amount_lkr) * 100)}% deployed`
                      : '—'}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Grants Tab */}
      {tab === 'grants' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="accent-indigo-500"
              />
              Active grants only
            </label>
            <Button
              id="btn-refresh-grants"
              variant="ghost"
              onClick={fetchGrants}
              disabled={loadingGrants}
              className="text-white/50 hover:text-white flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loadingGrants ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          {loadingGrants ? (
            <div className="text-white/40 text-center py-16">Loading grants…</div>
          ) : grants.length === 0 ? (
            <EmptyState
              title="No grants found"
              description="Award a grant to an independent learner or school using the button above."
            />
          ) : (
            grants.map((grant) => {
              const expired = isExpired(grant.expires_at);
              return (
                <motion.div
                  key={grant.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#1a1f2e] border border-white/10 rounded-xl px-5 py-4 space-y-2"
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={
                            grant.beneficiary_type === 'INDEPENDENT_LEARNER'
                              ? 'bg-indigo-900/60 text-indigo-300 border-indigo-700'
                              : 'bg-blue-900/60 text-blue-300 border-blue-700'
                          }
                        >
                          {grant.beneficiary_type === 'INDEPENDENT_LEARNER' ? 'Learner' : 'School'}
                        </Badge>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${!grant.is_active || expired
                            ? 'bg-red-900/40 text-red-400'
                            : 'bg-emerald-900/40 text-emerald-400'
                            }`}
                        >
                          {!grant.is_active ? 'Revoked' : expired ? 'Expired' : 'Active'}
                        </span>
                        <span className="text-white/60 text-sm font-mono">{grant.from_plan} → {grant.to_plan}</span>
                      </div>
                      <p className="text-white/40 text-xs font-mono">{grant.beneficiary_id}</p>
                      {grant.notes && (
                        <p className="text-white/50 text-xs italic">{grant.notes}</p>
                      )}
                    </div>
                    {grant.is_active && !expired && (
                      <Button
                        id={`btn-revoke-${grant.id}`}
                        variant="ghost"
                        disabled={revoking === grant.id}
                        onClick={() => handleRevokeGrant(grant.id)}
                        className="border border-red-900/50 text-red-400 hover:bg-red-900/30 text-xs px-3 py-1"
                      >
                        {revoking === grant.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <><Ban className="w-3 h-3 mr-1" />Revoke</>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-white/40">
                    <span>Granted: {fmtDate(grant.granted_at)}</span>
                    <span>Expires: {fmtDate(grant.expires_at)}</span>
                    {grant.estimated_cost_lkr > 0 && (
                      <span>Cost: {fmtLkr(grant.estimated_cost_lkr)}</span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Award Grant Modal */}
      {showAwardModal && (
        <AwardGrantModal
          pools={pools}
          onClose={() => setShowAwardModal(false)}
          onAwarded={() => { fetchGrants(); fetchPools(); }}
        />
      )}
    </div>
  );
}
