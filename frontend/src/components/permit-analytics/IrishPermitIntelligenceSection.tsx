import { useMemo, useState, useCallback, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bookmark,
  Search,
  RefreshCw,
  TrendingUp,
  Building2,
  MapPin,
  BarChart3,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { profileApi } from '@/services/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  usePermitSummary,
  usePermitSectors,
  usePermitCounties,
  usePermitCompanies,
  usePermitSearch,
  useMarketTrend,
  useSectorTrend,
  useTopReliabilityScores,
  usePermitDomainDashboard,
  usePermitWatchlist,
  useWatchlistMutation,
} from '@/hooks/usePermitAnalytics';
import type { CompanySearchParams, PermitCompany, PermitSector } from '@/services/permitAnalyticsService';
import { resolveProfileDomainKey, getDomainLabel } from '@/utils/domainResolver';
import {
  getTierBadgeClass,
  getTierLabel,
  getScoreColor,
  formatReliabilityScore,
} from '@/utils/reliabilityUtils';
import { CountUp } from './CountUp';
import { PanelSkeleton, CardSkeleton } from './PanelSkeleton';
import { CompanyProfileDrawer } from './CompanyProfileDrawer';
import { formatIE, formatPct, sectorColor } from './format';
import { YEAR_TABS, MONTH_FIELDS, TIER_TABS, type SelectedYear } from './constants';

const PAGE_SIZE = 50;
const SECTOR_CODES_TREND = ['J', 'Q', 'K', 'F', 'I', 'C', 'P', 'A'];

type SortKey = 'totalDesc' | 'totalAsc' | 'name' | 'rank' | 'reliability';

function truncateName(name: string, max = 28): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-slate-400">—</span>;
  if (rank === 1) return <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-amber-100 text-sm">👑</span>;
  if (rank === 2) return <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">2</span>;
  if (rank === 3) return <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">3</span>;
  return <span className="text-slate-500 text-sm font-medium">{rank}</span>;
}

function MomentumPill({ momentum }: { momentum: PermitCompany['momentum'] }) {
  if (!momentum) return <span className="text-slate-400 text-xs">—</span>;
  if (momentum === 'RISING') return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">↑ Rising</span>;
  if (momentum === 'DECLINING') return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium">↓ Declining</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">→ Flat</span>;
}

function ratePillClass(rate: number): string {
  if (rate >= 85) return 'bg-emerald-100 text-emerald-800';
  if (rate >= 70) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export function IrishPermitIntelligenceSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedYear, setSelectedYear] = useState<SelectedYear>(2026);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | null>(null);
  const [drawerCompany, setDrawerCompany] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [tierFilter, setTierFilter] = useState('');
  const [momentumFilter, setMomentumFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalDesc');
  const [leaderboardTier, setLeaderboardTier] = useState('');
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [hiddenSectors, setHiddenSectors] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const sector = searchParams.get('sector')?.trim().toUpperCase();
    if (sector) {
      setSelectedSectorFilter(sector);
      setPage(0);
    }
  }, [searchParams]);

  const yearNum = selectedYear === 'all' ? undefined : selectedYear;
  const isAllYears = selectedYear === 'all';

  const { data: summary, isLoading: summaryLoading } = usePermitSummary(yearNum);
  const { data: sectors, isLoading: sectorsLoading } = usePermitSectors(yearNum);
  const { data: counties, isLoading: countiesLoading } = usePermitCounties(yearNum);
  const { data: marketTrend, isLoading: marketLoading } = useMarketTrend(2009, 2026);
  const { data: sectorTrend, isLoading: sectorTrendLoading } = useSectorTrend(2009, 2026, SECTOR_CODES_TREND);

  const sectorSearchQ = useMemo(() => {
    if (!selectedSectorFilter || !sectors) return undefined;
    const sec = sectors.find((s) => s.sectorCode === selectedSectorFilter);
    if (!sec) return undefined;
    const parts = sec.sectorName.split(/[-–—]/);
    return (parts[parts.length - 1] ?? sec.sectorName).trim().slice(0, 40);
  }, [selectedSectorFilter, sectors]);

  const companyParams = useMemo((): CompanySearchParams => {
    const params: CompanySearchParams = { page, size: PAGE_SIZE };
    if (yearNum != null) params.year = yearNum;
    const q =
      searchQuery.trim().length >= 2 ? searchQuery.trim() : sectorSearchQ;
    if (q) params.q = q;
    if (momentumFilter) params.momentum = momentumFilter;
    if (statusFilter) params.status = statusFilter;
    if (tierFilter) params.tier = tierFilter;
    return params;
  }, [page, yearNum, momentumFilter, statusFilter, tierFilter, searchQuery, sectorSearchQ]);

  const listQuery = usePermitCompanies(companyParams, { enabled: !isAllYears && searchQuery.trim().length < 2 });
  const searchQueryResult = usePermitSearch(searchQuery);
  const companiesSource = searchQuery.trim().length >= 2 ? searchQueryResult : listQuery;

  const { data: watchlist = [] } = usePermitWatchlist();
  const { addMutation, removeMutation } = useWatchlistMutation();
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((c) => c.employerNameNormalised)),
    [watchlist],
  );

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.current(),
    queryFn: () => profileApi.get(),
    enabled: !!user,
  });

  const domainKey = useMemo(() => resolveProfileDomainKey(profile), [profile]);

  const { data: domainDash, isLoading: domainLoading } = usePermitDomainDashboard(
    domainKey,
    yearNum,
  );

  const { data: leaderboard, isLoading: leaderboardLoading } = useTopReliabilityScores(
    leaderboardTier || undefined,
    leaderboardPage,
    20,
  );

  const totalPermitsYear = useMemo(() => {
    if (!sectors?.length) return 0;
    return sectors.reduce((s, x) => s + x.grandTotal, 0);
  }, [sectors]);

  const yoyChange = useMemo(() => {
    if (isAllYears || !marketTrend?.length || typeof selectedYear !== 'number') return null;
    const cur = marketTrend.find((m) => m.year === selectedYear);
    const prev = marketTrend.find((m) => m.year === selectedYear - 1);
    if (!cur || !prev || prev.totalPermits === 0) return null;
    return ((cur.totalPermits - prev.totalPermits) / prev.totalPermits) * 100;
  }, [marketTrend, selectedYear, isAllYears]);

  const mergedSectorTrend = useMemo(() => {
    if (!sectorTrend?.length) return [];
    const years = new Set<number>();
    for (const s of sectorTrend) {
      for (const d of s.dataPoints) years.add(d.year);
    }
    return Array.from(years)
      .sort((a, b) => a - b)
      .map((year) => {
        const row: Record<string, number> = { year };
        for (const s of sectorTrend) {
          const pt = s.dataPoints.find((d) => d.year === year);
          row[s.sectorCode] = pt?.grandTotal ?? 0;
        }
        return row;
      });
  }, [sectorTrend]);

  const sortedCompanies = useMemo(() => {
    const rows = [...(companiesSource.data?.content ?? [])];
    switch (sortKey) {
      case 'totalAsc':
        rows.sort((a, b) => a.grandTotal - b.grandTotal);
        break;
      case 'name':
        rows.sort((a, b) => a.employerName.localeCompare(b.employerName));
        break;
      case 'rank':
        rows.sort((a, b) => (a.rankOverall ?? 9999) - (b.rankOverall ?? 9999));
        break;
      case 'reliability':
        rows.sort((a, b) => (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0));
        break;
      default:
        rows.sort((a, b) => b.grandTotal - a.grandTotal);
    }
    return rows;
  }, [companiesSource.data?.content, sortKey]);

  const availableMonths = useMemo(() => {
    const sample = sortedCompanies[0];
    if (!sample) return MONTH_FIELDS.slice(0, 4);
    return MONTH_FIELDS.filter((m) => sample[m.key as keyof PermitCompany] != null);
  }, [sortedCompanies]);

  const sectorChartData = useMemo(() => {
    if (!sectors) return [];
    const total = sectors.reduce((s, x) => s + x.grandTotal, 0) || 1;
    return [...sectors]
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .map((s) => ({
        ...s,
        fill: sectorColor(s.sectorCode),
        pct: (s.grandTotal / total) * 100,
      }));
  }, [sectors]);

  const countyChartData = useMemo(() => {
    return (counties ?? []).slice(0, 10);
  }, [counties]);

  const marketChartData = useMemo(() => {
    if (!marketTrend) return [];
    return marketTrend.map((m, i, arr) => {
      const prev = arr[i - 1];
      const yoy = prev && prev.totalPermits > 0
        ? ((m.totalPermits - prev.totalPermits) / prev.totalPermits) * 100
        : 0;
      return { ...m, yoy };
    });
  }, [marketTrend]);

  const activeCompanyCount = useMemo(() => {
    if (typeof yearNum === 'number' && companiesSource.data) {
      return companiesSource.data.totalElements;
    }
    return summary?.activeCompanyCount ?? 0;
  }, [yearNum, companiesSource.data, summary]);

  const filtersActive = !!(selectedSectorFilter || tierFilter || momentumFilter || statusFilter);

  const refreshAll = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.permits.all });
    setRefreshing(false);
  };

  const toggleWatchlist = useCallback(
    (name: string) => {
      if (watchlistSet.has(name)) {
        removeMutation.mutate(name);
      } else {
        addMutation.mutate(name);
      }
    },
    [watchlistSet, addMutation, removeMutation],
  );

  const searchResult = searchQuery.trim().length >= 2 ? searchQueryResult.data?.content?.[0] : null;

  return (
    <section className="border-t-4 border-teal-600 bg-gradient-to-b from-teal-50/80 to-white mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">🇮🇪 Irish Employment Permit Intelligence</h2>
            <p className="text-sm text-slate-600 mt-1">
              Official data from the Department of Enterprise · 2009–2026 · Updated daily
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {YEAR_TABS.map((tab) => (
              <button
                key={String(tab.value)}
                type="button"
                onClick={() => {
                  setSelectedYear(tab.value);
                  setPage(0);
                  setSelectedSectorFilter(null);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedYear === tab.value
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel 1 — KPIs */}
        {!isAllYears && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryLoading || sectorsLoading ? (
              <>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Total permits issued</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    <CountUp value={totalPermitsYear} />
                  </p>
                  {yoyChange != null && (
                    <span className={`text-xs font-semibold mt-2 inline-block ${yoyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {yoyChange >= 0 ? '+' : ''}{formatPct(yoyChange)} vs {typeof selectedYear === 'number' ? selectedYear - 1 : ''}
                    </span>
                  )}
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Active sponsoring companies</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    <CountUp value={activeCompanyCount} />
                  </p>
                  <p className="text-xs text-slate-400 mt-2">in {selectedYear}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">#1 Sector</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate">{sectors?.[0]?.sectorName ?? '—'}</p>
                  <p className="text-sm text-teal-700 font-semibold">{formatIE(sectors?.[0]?.grandTotal ?? 0)} permits</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">#1 County</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate">{counties?.[0]?.county ?? '—'}</p>
                  <p className="text-sm text-teal-700 font-semibold">{formatIE(counties?.[0]?.issued ?? 0)} issued</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Panel 6 & 7 — All years */}
        {isAllYears && (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900">Ireland Employment Permit Market 2009–2026</h3>
              {marketLoading ? (
                <PanelSkeleton className="h-72 mt-4" />
              ) : (
                <div className="h-72 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={marketChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tickFormatter={(v) => formatIE(Number(v))} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number, name: string) =>
                          name === 'yoy' ? [formatPct(v), 'YoY change'] : [formatIE(v), 'Total permits']
                        }
                      />
                      <Bar yAxisId="left" dataKey="totalPermits" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" type="monotone" dataKey="yoy" stroke="#0d9488" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Sector Demand Over 18 Years</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {(sectorTrend ?? []).map((s) => (
                  <button
                    key={s.sectorCode}
                    type="button"
                    onClick={() => {
                      setHiddenSectors((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.sectorCode)) next.delete(s.sectorCode);
                        else next.add(s.sectorCode);
                        return next;
                      });
                    }}
                    className={`text-xs px-2 py-1 rounded-full border ${hiddenSectors.has(s.sectorCode) ? 'opacity-40 border-slate-200' : 'border-slate-300 font-medium'}`}
                    style={{ borderColor: sectorColor(s.sectorCode) }}
                  >
                    {s.sectorCode} · {s.sectorName.split(' - ')[0]?.slice(0, 20)}
                  </button>
                ))}
              </div>
              {sectorTrendLoading ? (
                <PanelSkeleton className="h-72" />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={mergedSectorTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatIE(Number(v))} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      {(sectorTrend ?? []).map((s) =>
                        !hiddenSectors.has(s.sectorCode) ? (
                          <Line
                            key={s.sectorCode}
                            type="monotone"
                            dataKey={s.sectorCode}
                            name={`${s.sectorCode} ${s.sectorName}`}
                            stroke={sectorColor(s.sectorCode)}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                          />
                        ) : null,
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* Panel 2 — Sectors */}
        {!isAllYears && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">Sector Demand {selectedYear}</h3>
            <p className="text-xs text-slate-500 mb-4">Click a bar to filter companies</p>
            {sectorsLoading ? (
              <PanelSkeleton className="h-80" />
            ) : sectorChartData.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No sector data for this year yet.</div>
            ) : (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={sectorChartData}
                      margin={{ left: 8, right: 24 }}
                      onClick={(state) => {
                        const code = (state?.activePayload?.[0]?.payload as PermitSector)?.sectorCode;
                        if (code) setSelectedSectorFilter(code);
                      }}
                    >
                      <XAxis type="number" tickFormatter={(v) => formatIE(Number(v))} />
                      <YAxis type="category" dataKey="sectorName" width={180} tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const p = payload[0].payload as PermitSector & { pct: number };
                          return (
                            <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl max-w-xs">
                              <p className="font-semibold">{p.sectorName}</p>
                              <p>{formatIE(p.grandTotal)} permits ({formatPct(p.pct)})</p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="grandTotal" radius={[0, 4, 4, 0]}>
                        {sectorChartData.map((s) => (
                          <Cell key={s.sectorCode} fill={s.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {sectorChartData.map((s) => (
                    <span
                      key={s.sectorCode}
                      className="text-xs px-2 py-1 rounded-full bg-slate-50 border border-slate-200"
                    >
                      <span className="font-bold" style={{ color: s.fill }}>{s.sectorCode}</span> {formatIE(s.grandTotal)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Panel 3 — Counties */}
        {!isAllYears && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">County Intelligence</h3>
            {countiesLoading ? (
              <PanelSkeleton className="h-64" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={countyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="county" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
                      <YAxis yAxisId="left" tickFormatter={(v) => formatIE(Number(v))} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          name === 'approvalRatePct' ? formatPct(v) : formatIE(v),
                          name === 'approvalRatePct' ? 'Approval rate' : name,
                        ]}
                      />
                      <Bar yAxisId="left" dataKey="issued" fill="#0d9488" name="Issued" />
                      <Bar yAxisId="left" dataKey="refused" fill="#f59e0b" name="Refused" />
                      <Line yAxisId="right" type="monotone" dataKey="approvalRatePct" stroke="#6366f1" strokeWidth={2} name="Rate %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="lg:col-span-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b">
                        <th className="py-2">#</th>
                        <th>County</th>
                        <th>Issued</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(counties ?? []).slice(0, 12).map((c, i) => (
                        <tr key={c.id} className="border-b border-slate-50">
                          <td className="py-2 text-slate-400">{i + 1}</td>
                          <td className="font-medium">{c.county}</td>
                          <td>{formatIE(c.issued)}</td>
                          <td>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ratePillClass(Number(c.approvalRatePct))}`}>
                              {formatPct(Number(c.approvalRatePct))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Panel 4 — Sponsor table */}
        {!isAllYears && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 size={16} /> Sponsor Intelligence
            </h3>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search any company — Google, HSE, Meta, Accenture, Amazon..."
                className="w-full pl-12 pr-4 py-3.5 text-base border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <p className="text-xs text-slate-500">
              Showing {sortedCompanies.length} of {formatIE(companiesSource.data?.totalElements ?? 0)} companies in official {selectedYear} permit dataset
            </p>

            {searchQuery.trim().length >= 2 && (
              <div className="rounded-lg border p-4 text-sm">
                {companiesSource.isLoading ? (
                  <PanelSkeleton className="h-12" />
                ) : searchResult && searchResult.grandTotal > 0 ? (
                  <div className="text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <strong>Found in official {selectedYear} data</strong>
                    <p className="text-xs mt-1">
                      Rank #{searchResult.rankOverall} · {formatIE(searchResult.grandTotal)} permits ·{' '}
                      {searchResult.reliabilityTier ?? '—'} · {searchResult.momentum ?? '—'}
                    </p>
                  </div>
                ) : searchResult && searchResult.grandTotal === 0 ? (
                  <div className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <strong>No permits recorded in {selectedYear}</strong>
                    <p className="text-xs mt-1">Last activity may appear in other years — open profile for history.</p>
                  </div>
                ) : (
                  <div className="text-amber-950 bg-amber-50 border border-amber-300 rounded-lg p-3">
                    <strong>Not found in the {selectedYear} official permit dataset</strong>
                    <p className="text-xs mt-1">
                      This means no employment permits were issued to this company in {selectedYear}. This does not necessarily mean they do not sponsor — check other years.
                    </p>
                    <button type="button" className="text-xs font-semibold text-teal-700 mt-2 underline" onClick={() => setSelectedYear('all')}>
                      Check all years →
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center text-xs">
              {selectedSectorFilter && (
                <button type="button" onClick={() => setSelectedSectorFilter(null)} className="px-2 py-1 rounded-full bg-teal-100 text-teal-800 font-medium">
                  Sector: {selectedSectorFilter} ×
                </button>
              )}
              {TIER_TABS.map((t) => (
                <button
                  key={t.id || 'all'}
                  type="button"
                  onClick={() => setTierFilter(t.id)}
                  className={`px-2 py-1 rounded-full border ${tierFilter === t.id ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600'}`}
                >
                  {t.label}
                </button>
              ))}
              {['', 'RISING', 'FLAT', 'DECLINING'].map((m) => (
                <button
                  key={m || 'all-m'}
                  type="button"
                  onClick={() => setMomentumFilter(m)}
                  className={`px-2 py-1 rounded-full border ${momentumFilter === m ? 'bg-slate-800 text-white' : 'border-slate-200'}`}
                >
                  {m === '' ? 'All momentum' : m === 'RISING' ? '↑ Rising' : m === 'FLAT' ? '→ Flat' : '↓ Declining'}
                </button>
              ))}
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="ml-auto border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
              >
                <option value="totalDesc">Total ↓</option>
                <option value="totalAsc">Total ↑</option>
                <option value="name">Name</option>
                <option value="rank">Rank</option>
                <option value="reliability">Reliability Score</option>
              </select>
              {filtersActive && (
                <button
                  type="button"
                  className="text-teal-700 underline"
                  onClick={() => {
                    setSelectedSectorFilter(null);
                    setTierFilter('');
                    setMomentumFilter('');
                    setStatusFilter('');
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {companiesSource.isLoading ? (
              <PanelSkeleton className="h-64" />
            ) : sortedCompanies.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <BarChart3 className="mx-auto mb-2 opacity-40" size={40} />
                <p>No companies match your filters.</p>
                <button type="button" className="mt-3 text-sm text-teal-700 font-medium" onClick={() => setSearchQuery('')}>
                  Clear search
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 border-b">
                      <th className="py-2 pr-2">Rank</th>
                      <th className="py-2 pr-4">Company</th>
                      {availableMonths.map((m) => (
                        <th key={m.key} className="py-2 px-1 text-center">{m.label}</th>
                      ))}
                      <th className="py-2 px-2">Total</th>
                      <th className="py-2 px-2">Reliability</th>
                      <th className="py-2 px-2">Momentum</th>
                      <th className="py-2">★</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompanies.map((row) => (
                      <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80">
                        <td className="py-2"><RankBadge rank={row.rankOverall} /></td>
                        <td className="py-2 pr-4 max-w-[200px]">
                          <button
                            type="button"
                            className="font-medium text-slate-900 hover:text-teal-700 text-left"
                            title={row.employerName}
                            onClick={() => setDrawerCompany(row.employerNameNormalised)}
                          >
                            {truncateName(row.employerName)}
                          </button>
                          {row.reliabilityTier && (
                            <p className={`text-[10px] mt-0.5 inline-block px-1.5 rounded ${getTierBadgeClass(row.reliabilityTier)}`}>
                              {getTierLabel(row.reliabilityTier)}
                              {row.yearsActive != null ? ` · ${row.yearsActive} yrs` : ''}
                            </p>
                          )}
                        </td>
                        {availableMonths.map((m) => {
                          const v = row[m.key as keyof PermitCompany] as number | null;
                          return (
                            <td key={m.key} className="text-center text-xs text-slate-500 px-1">
                              {v != null && v > 0 ? formatIE(v) : '—'}
                            </td>
                          );
                        })}
                        <td className="py-2 px-2 font-bold">{formatIE(row.grandTotal)}</td>
                        <td className="py-2 px-2">
                          {row.reliabilityScore != null ? (
                            <div>
                              <span className={`font-bold ${getScoreColor(row.reliabilityScore)}`}>
                                {formatReliabilityScore(row.reliabilityScore)}
                              </span>
                              {row.yearsActive != null && (
                                <p className="text-[10px] text-slate-500">{row.yearsActive} active yrs</p>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2 px-2"><MomentumPill momentum={row.momentum} /></td>
                        <td className="py-2">
                          <button
                            type="button"
                            title={watchlistSet.has(row.employerNameNormalised) ? 'Remove from watchlist' : 'Add to watchlist'}
                            onClick={() => toggleWatchlist(row.employerNameNormalised)}
                            className="p-1 rounded hover:bg-slate-100"
                          >
                            <Bookmark
                              size={18}
                              className={watchlistSet.has(row.employerNameNormalised) ? 'fill-teal-600 text-teal-600' : 'text-slate-300'}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(companiesSource.data?.totalPages ?? 0) > 1 && (
              <div className="flex items-center justify-between text-sm text-slate-600 pt-2">
                <span>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, companiesSource.data?.totalElements ?? 0)} of{' '}
                  {formatIE(companiesSource.data?.totalElements ?? 0)}
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="p-2 border rounded-lg disabled:opacity-40">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={page >= (companiesSource.data?.totalPages ?? 1) - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 border rounded-lg disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Panel 8 — Leaderboard */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900">Most Reliable Sponsors in Ireland</h3>
          <p className="text-xs text-slate-500 mb-4">Based on 18 years of official permit data</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[{ id: '', label: 'All' }, { id: 'ELITE', label: '🏆 Elite' }, { id: 'STRONG', label: '⭐ Strong' }, { id: 'CONSISTENT', label: '✅ Consistent' }].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setLeaderboardTier(t.id);
                  setLeaderboardPage(0);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium ${leaderboardTier === t.id ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {leaderboardLoading ? (
            <PanelSkeleton className="h-48" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b text-left">
                    <th className="py-2">Rank</th>
                    <th>Company</th>
                    <th>Score</th>
                    <th>Years</th>
                    <th>First</th>
                    <th>Peak</th>
                    <th>Trend</th>
                    <th>★</th>
                  </tr>
                </thead>
                <tbody>
                  {(leaderboard?.content ?? []).map((row, i) => (
                    <tr
                      key={row.employerNameNormalised}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                      onClick={() => setDrawerCompany(row.employerNameNormalised)}
                    >
                      <td className="py-2">{leaderboardPage * 20 + i + 1}</td>
                      <td className="font-medium py-2">{truncateName(row.canonicalName, 32)}</td>
                      <td className={`font-bold ${getScoreColor(row.reliabilityScore)}`}>{formatReliabilityScore(row.reliabilityScore)}</td>
                      <td>{row.yearsActive}</td>
                      <td>{row.firstSeenYear}</td>
                      <td>{row.peakYear ?? '—'}</td>
                      <td className="text-xs">{row.trend3yr}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => toggleWatchlist(row.employerNameNormalised)}>
                          <Bookmark size={16} className={watchlistSet.has(row.employerNameNormalised) ? 'fill-teal-600 text-teal-600' : 'text-slate-300'} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel 9 — Domain */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp size={16} /> My Domain Snapshot
          </h3>
          {!user ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <Lock className="mx-auto text-slate-400 mb-2" size={32} />
              <p className="text-sm text-slate-600">Sign in to see permit insights for your industry.</p>
              <Link to="/login" className="inline-block mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold">
                Sign in
              </Link>
            </div>
          ) : domainLoading ? (
            <PanelSkeleton className="h-40 mt-4" />
          ) : domainDash ? (
            <div className="mt-4 space-y-4">
              <p className="text-lg font-bold text-slate-900">
                Your Industry: {domainDash.sectorName}{' '}
                <span className="text-sm font-normal text-teal-700">({getDomainLabel(domainKey)})</span>
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">Top sponsors in your sector</h4>
                  <ul className="space-y-2 text-sm">
                    {domainDash.topCompanies.slice(0, 10).map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <button type="button" className="text-left hover:text-teal-700 truncate" onClick={() => setDrawerCompany(c.employerNameNormalised)}>
                          {truncateName(c.employerName, 24)}
                        </button>
                        <span className="font-semibold shrink-0">{formatIE(c.grandTotal)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                    <MapPin size={12} /> Counties
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {domainDash.counties.slice(0, 8).map((c) => (
                      <li key={c.id} className="flex justify-between">
                        <span>{c.county}</span>
                        <span>{formatIE(c.issued)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500 border-t border-slate-200 pt-6 space-y-2">
          <p>
            Data sourced from Department of Enterprise, Trade and Employment · 2026 data updated daily · Historical data 2009–2025 is complete
          </p>
          <p>
            Last refreshed:{' '}
            {summary?.lastRefreshed
              ? new Date(summary.lastRefreshed).toLocaleString('en-IE')
              : '—'}
            {' · '}
            <button type="button" onClick={() => void refreshAll()} className="text-teal-700 font-semibold inline-flex items-center gap-1">
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh now
            </button>
            {' · '}
            <a href="https://enterprise.gov.ie/en/what-we-do/work-permits/" target="_blank" rel="noopener noreferrer" className="text-teal-700 font-semibold">
              Source ↗
            </a>
          </p>
        </div>
      </div>

      <CompanyProfileDrawer
        normalisedName={drawerCompany}
        selectedYear={selectedYear}
        onClose={() => setDrawerCompany(null)}
        inWatchlist={drawerCompany ? watchlistSet.has(drawerCompany) : false}
        onToggleWatchlist={() => drawerCompany && toggleWatchlist(drawerCompany)}
      />
    </section>
  );
}
