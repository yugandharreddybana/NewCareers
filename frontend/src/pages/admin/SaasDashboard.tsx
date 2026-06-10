import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Activity,
  Building2,
  DollarSign,
  Flag,
  RefreshCw,
  TrendingDown,
  Users,
} from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { useAuth } from '@/context/authCtx';
import {
  saasAdminApi,
  type FeatureFlagRow,
  type SubscriptionPlanCode,
  type SubscriptionStatusCode,
} from '@/services/saasAdminApi';

const STALE_MS = 30_000;

const PLAN_OPTIONS: SubscriptionPlanCode[] = ['FREE', 'PRO', 'ENTERPRISE'];
const STATUS_OPTIONS: SubscriptionStatusCode[] = ['ACTIVE', 'PAST_DUE', 'CANCELLED'];

function MetricCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function SaasDashboard() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [planFilter, setPlanFilter] = useState<SubscriptionPlanCode | ''>('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusCode | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [overrideOrgId, setOverrideOrgId] = useState<string | null>(null);
  const [overridePlan, setOverridePlan] = useState<SubscriptionPlanCode>('PRO');

  const listParams = useMemo(
    () => ({
      page,
      size: 20,
      ...(planFilter ? { plan: planFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
    }),
    [page, planFilter, statusFilter, search],
  );

  const metricsQuery = useQuery({
    queryKey: ['admin-saas', 'metrics'],
    queryFn: saasAdminApi.getMetrics,
    staleTime: STALE_MS,
    enabled: isAdmin,
  });

  const subscriptionsQuery = useQuery({
    queryKey: ['admin-saas', 'subscriptions', listParams],
    queryFn: () => saasAdminApi.listSubscriptions(listParams),
    staleTime: STALE_MS,
    enabled: isAdmin,
  });

  const flagsQuery = useQuery({
    queryKey: ['admin-saas', 'feature-flags'],
    queryFn: saasAdminApi.listFeatureFlags,
    staleTime: STALE_MS,
    enabled: isAdmin,
  });

  const aiUsageQuery = useQuery({
    queryKey: ['admin-saas', 'ai-usage'],
    queryFn: saasAdminApi.getAiUsage,
    staleTime: STALE_MS,
    enabled: isAdmin,
  });

  const toggleFlagMutation = useMutation({
    mutationFn: saasAdminApi.toggleFeatureFlag,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['admin-saas', 'feature-flags'] });
      const prev = queryClient.getQueryData<FeatureFlagRow[]>(['admin-saas', 'feature-flags']);
      queryClient.setQueryData<FeatureFlagRow[]>(['admin-saas', 'feature-flags'], (old) =>
        old?.map(f => (f.id === id ? { ...f, enabled: !f.enabled } : f)) ?? [],
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin-saas', 'feature-flags'], ctx.prev);
      toast.error('Failed to toggle feature flag.');
    },
    onSuccess: () => toast.success('Feature flag updated.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-saas', 'feature-flags'] }),
  });

  const overrideMutation = useMutation({
    mutationFn: ({ orgId, plan }: { orgId: string; plan: SubscriptionPlanCode }) =>
      saasAdminApi.overridePlan(orgId, { plan }),
    onSuccess: () => {
      toast.success('Plan overridden.');
      setOverrideOrgId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-saas', 'subscriptions'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-saas', 'metrics'] });
    },
    onError: () => toast.error('Failed to override plan.'),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-saas'] });
  };

  const initialLoading =
    metricsQuery.isLoading &&
    subscriptionsQuery.isLoading &&
    flagsQuery.isLoading &&
    aiUsageQuery.isLoading;

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        Admin access required.
      </div>
    );
  }

  if (initialLoading) return <PageLoader />;

  const metrics = metricsQuery.data;

  return (
    <>
      <PageMeta title="SaaS Admin — NewCareers" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SaaS Operations</h1>
            <p className="text-sm text-gray-500 mt-1">
              Live platform metrics, subscriptions, feature flags, and AI usage.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
            onClick={refreshAll}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Metrics row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            label="Total Users"
            value={metrics ? metrics.totalUsers.toLocaleString() : '—'}
            icon={<Users size={18} />}
          />
          <MetricCard
            label="MRR"
            value={metrics ? `€${Number(metrics.mrr).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
            icon={<DollarSign size={18} />}
            sub="ACTIVE subs × plan price"
          />
          <MetricCard
            label="Active Subscriptions"
            value={metrics ? metrics.activeSubscriptions.toLocaleString() : '—'}
            icon={<Building2 size={18} />}
            sub="ACTIVE subscriptions"
          />
          <MetricCard
            label="Churn"
            value={metrics ? `${metrics.churnRatePercent.toFixed(1)}%` : '—'}
            icon={<TrendingDown size={18} />}
            sub="30-day window"
          />
        </section>

        {/* Subscriptions */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h2 className="font-semibold text-gray-900">Subscriptions</h2>
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                placeholder="Search org name…"
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearch(searchInput.trim());
                    setPage(0);
                  }
                }}
              />
              <select
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value as SubscriptionPlanCode | '');
                  setPage(0);
                }}
              >
                <option value="">All plans</option>
                {PLAN_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as SubscriptionStatusCode | '');
                  setPage(0);
                }}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Organization</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(subscriptionsQuery.data?.rows ?? []).map(row => (
                  <tr key={row.orgId} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{row.orgName}</td>
                    <td className="px-5 py-3">{row.plan}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                        onClick={() => {
                          setOverrideOrgId(row.orgId);
                          setOverridePlan(row.plan === 'FREE' ? 'PRO' : row.plan);
                        }}
                      >
                        Override plan
                      </button>
                    </td>
                  </tr>
                ))}
                {!subscriptionsQuery.data?.rows.length && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                      No subscriptions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(subscriptionsQuery.data?.totalPages ?? 0) > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {(subscriptionsQuery.data?.page ?? 0) + 1} of {subscriptionsQuery.data?.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 0}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= (subscriptionsQuery.data?.totalPages ?? 1) - 1}
                  className="px-3 py-1 border rounded disabled:opacity-40"
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feature flags */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Flag size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">Feature Flags</h2>
            </div>
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {(flagsQuery.data ?? []).map(flag => (
                <li key={flag.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-800 truncate">{flag.flagKey}</p>
                    {flag.description && (
                      <p className="text-xs text-gray-500 truncate">{flag.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={flag.enabled}
                    disabled={toggleFlagMutation.isPending}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      flag.enabled ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                    onClick={() => toggleFlagMutation.mutate(flag.id)}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        flag.enabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </li>
              ))}
              {!flagsQuery.data?.length && (
                <li className="px-5 py-8 text-center text-gray-400 text-sm">No feature flags.</li>
              )}
            </ul>
          </section>

          {/* AI usage */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Activity size={16} className="text-gray-400" />
              <h2 className="font-semibold text-gray-900">AI Usage (this month)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3 text-right">Tokens</th>
                    <th className="px-5 py-3 text-right">Cost USD</th>
                    <th className="px-5 py-3 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(aiUsageQuery.data ?? []).map(row => (
                    <tr key={row.orgId}>
                      <td className="px-5 py-3 font-medium">{row.orgName}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {row.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        ${Number(row.totalCostUsd).toFixed(4)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{row.requestCount}</td>
                    </tr>
                  ))}
                  {!aiUsageQuery.data?.length && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                        No AI usage this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Override plan modal */}
      {overrideOrgId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Override subscription plan</h3>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={overridePlan}
              onChange={(e) => setOverridePlan(e.target.value as SubscriptionPlanCode)}
            >
              {PLAN_OPTIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 text-sm border rounded-lg"
                onClick={() => setOverrideOrgId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overrideMutation.isPending}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg disabled:opacity-50"
                onClick={() => overrideMutation.mutate({ orgId: overrideOrgId, plan: overridePlan })}
              >
                {overrideMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
