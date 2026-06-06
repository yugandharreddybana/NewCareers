import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, ExternalLink, RefreshCw, Search } from 'lucide-react';
import type { DomainKey } from '@/utils/domainResolver';
import {
  getDomainSectorCode,
  DOMAIN_OPTIONS,
} from '@/utils/domainResolver';
import {
  usePermitDomainDashboard,
  usePermitSectors,
  usePermitSummary,
  usePermitSearch,
  useCompanyHistory,
  usePermitWatchlist,
  useWatchlistMutation,
} from '@/hooks/usePermitAnalytics';
import { queryKeys } from '@/lib/queryKeys';
import { CountUp } from '@/components/permit-analytics/CountUp';
import { ReliabilityScoreRing } from './ReliabilityScoreRing';
import { formatIE, formatPct } from '@/components/permit-analytics/format';
import { getTierBadgeClass, getTierLabel } from '@/utils/reliabilityUtils';
import type { PermitCompany } from '@/services/permitAnalyticsService';

const LATEST_YEAR = 2026;
const RECENT_YEARS = [2022, 2023, 2024, 2025, 2026] as const;
const MONTH_KEYS = [
  'permitsJan',
  'permitsFeb',
  'permitsMar',
  'permitsApr',
] as const;

interface Props {
  domainKey: DomainKey;
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateName(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

type SearchState = 'idle' | 'loading' | 'active' | 'inactive' | 'missing';

export function DomainPermitWidget({ domainKey }: Props) {
  const qc = useQueryClient();
  const [lookup, setLookup] = useState('');
  const [submitted, setSubmitted] = useState('');

  const sectorCode = getDomainSectorCode(domainKey);
  const domainLabel =
    DOMAIN_OPTIONS.find((o) => o.key === domainKey)?.label ?? domainKey;

  const { data: dash, isLoading: dashLoading, isError: dashError } =
    usePermitDomainDashboard(domainKey, LATEST_YEAR);
  const { data: sectors2026 } = usePermitSectors(LATEST_YEAR);
  const { data: sectors2025 } = usePermitSectors(2025);
  const { data: summary } = usePermitSummary(LATEST_YEAR);

  const { data: searchResult, isFetching: searchLoading } = usePermitSearch(submitted);
  const match = searchResult?.content?.[0];
  const historyName = match?.employerNameNormalised ?? '';
  const { data: history } = useCompanyHistory(historyName);

  const { data: watchlist = [] } = usePermitWatchlist();
  const { addMutation, removeMutation } = useWatchlistMutation();
  const watchlistSet = useMemo(
    () => new Set(watchlist.map((c) => c.employerNameNormalised)),
    [watchlist],
  );

  const primarySector = useMemo(() => {
    if (!dash?.sectors?.length) return null;
    return (
      dash.sectors.find((s) => s.sectorCode === sectorCode) ?? dash.sectors[0]
    );
  }, [dash?.sectors, sectorCode]);

  const sectorRank = useMemo(() => {
    if (!sectors2026?.length || !primarySector) return null;
    const sorted = [...sectors2026].sort((a, b) => b.grandTotal - a.grandTotal);
    const idx = sorted.findIndex((s) => s.sectorCode === primarySector.sectorCode);
    return idx >= 0 ? idx + 1 : null;
  }, [sectors2026, primarySector]);

  const sectorSharePct = useMemo(() => {
    if (!primarySector || !sectors2026?.length) return null;
    const total = sectors2026.reduce((s, x) => s + x.grandTotal, 0);
    if (total === 0) return null;
    return (primarySector.grandTotal / total) * 100;
  }, [primarySector, sectors2026]);

  const sectorYoy = useMemo(() => {
    if (!primarySector || !sectors2025?.length) return null;
    const prev = sectors2025.find((s) => s.sectorCode === primarySector.sectorCode);
    if (!prev || prev.grandTotal === 0) return null;
    return (
      ((primarySector.grandTotal - prev.grandTotal) / prev.grandTotal) * 100
    );
  }, [primarySector, sectors2025]);

  const sparkline = useMemo(() => {
    if (!primarySector) return [0, 0, 0, 0];
    return MONTH_KEYS.map((k) => {
      const v = primarySector[k];
      return typeof v === 'number' ? v : 0;
    });
  }, [primarySector]);

  const sparkMax = useMemo(
    () => Math.max(...sparkline, 1),
    [sparkline],
  );

  const topReliable = useMemo(() => {
    const rows = [...(dash?.topCompanies ?? [])];
    rows.sort((a, b) => (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0));
    return rows.filter((c) => c.reliabilityScore != null).slice(0, 5);
  }, [dash?.topCompanies]);

  const sponsorCount = dash?.topCompanies?.length ?? 0;

  const searchState: SearchState = useMemo(() => {
    if (!submitted.trim()) return 'idle';
    if (searchLoading) return 'loading';
    if (!match) return 'missing';
    if (match.grandTotal > 0 && match.status !== 'INACTIVE') return 'active';
    return 'inactive';
  }, [submitted, searchLoading, match]);

  const historyDots = useMemo(() => {
    const byYear = new Map(
      (history ?? []).map((h) => [h.year, h.grandTotal]),
    );
    return RECENT_YEARS.map((year) => ({
      year,
      total: byYear.get(year) ?? 0,
      active: (byYear.get(year) ?? 0) > 0,
    }));
  }, [history]);

  const lastSeenYear = useMemo(() => {
    if (!history?.length) return null;
    const active = history.filter((h) => h.grandTotal > 0);
    if (!active.length) return null;
    return Math.max(...active.map((h) => h.year));
  }, [history]);

  const toggleWatchlist = useCallback(
    (company: PermitCompany) => {
      const key = company.employerNameNormalised;
      if (watchlistSet.has(key)) {
        removeMutation.mutate(key);
      } else {
        addMutation.mutate(key);
      }
    },
    [watchlistSet, addMutation, removeMutation],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(lookup.trim());
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.permits.all });
  };

  if (dashLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-8 bg-slate-100 rounded w-1/2" />
              <div className="h-20 bg-slate-50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (dashError || !dash) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm text-amber-900 font-medium">
          Permit intelligence is temporarily unavailable.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-3 inline-flex items-center gap-2 text-sm text-teal-700 hover:underline"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
        {/* Column A — Sector pulse */}
        <div className="p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Sector pulse
          </p>
          <div className="flex items-start gap-2 mb-3">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug flex-1">
              {primarySector?.sectorName ?? domainLabel}
            </h3>
            {primarySector && (
              <span className="shrink-0 rounded-md bg-teal-50 text-teal-800 text-xs font-bold px-2 py-0.5">
                {primarySector.sectorCode}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">
            <CountUp value={primarySector?.grandTotal ?? 0} />
            <span className="text-sm font-normal text-slate-500 ml-1">
              permits ({LATEST_YEAR})
            </span>
          </p>
          {sectorRank != null && (
            <p className="text-xs text-slate-600 mt-1">
              #{sectorRank} most active sector
            </p>
          )}
          {sectorSharePct != null && (
            <p className="text-xs text-slate-500 mt-0.5">
              {formatPct(sectorSharePct)} of all permits
            </p>
          )}
          <div className="flex items-end gap-1 h-10 mt-4" aria-hidden>
            {sparkline.map((v, i) => (
              <div
                key={MONTH_KEYS[i]}
                className="flex-1 rounded-sm bg-teal-500/80 min-h-[4px] transition-all"
                style={{ height: `${Math.max(8, (v / sparkMax) * 100)}%` }}
                title={`${MONTH_KEYS[i]}: ${formatIE(v)}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Jan – Apr {LATEST_YEAR}</p>
          {sectorYoy != null && (
            <span
              className={`inline-block mt-3 text-xs font-semibold px-2 py-0.5 rounded-full ${
                sectorYoy >= 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {sectorYoy >= 0 ? '+' : ''}
              {formatPct(sectorYoy)} vs {LATEST_YEAR - 1}
            </span>
          )}
        </div>

        {/* Column B — Reliable sponsors */}
        <div className="p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Most Reliable Sponsors
          </p>
          {topReliable.length === 0 ? (
            <p className="text-sm text-slate-500">No scored sponsors in this sector yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {topReliable.map((c) => (
                <li key={c.employerNameNormalised} className="flex items-center gap-2">
                  <ReliabilityScoreRing
                    score={c.reliabilityScore ?? 0}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-medium text-slate-900 truncate"
                      title={c.employerName}
                    >
                      {truncateName(c.employerName)}
                    </p>
                    {c.reliabilityTier && (
                      <span
                        className={`inline-block mt-0.5 text-[10px] px-1.5 py-0 rounded ${getTierBadgeClass(c.reliabilityTier)}`}
                      >
                        {getTierLabel(c.reliabilityTier).replace(/^[^\s]+\s/, '')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
                    {formatIE(c.grandTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWatchlist(c)}
                    className="shrink-0 p-1 text-slate-400 hover:text-teal-600"
                    title={
                      watchlistSet.has(c.employerNameNormalised)
                        ? 'Remove from watchlist'
                        : 'Add to watchlist'
                    }
                  >
                    <Bookmark
                      size={16}
                      className={
                        watchlistSet.has(c.employerNameNormalised)
                          ? 'fill-teal-600 text-teal-600'
                          : ''
                      }
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link
            to={`/analytics?sector=${encodeURIComponent(sectorCode)}`}
            className="inline-block mt-4 text-xs font-semibold text-teal-700 hover:underline"
          >
            View all {formatIE(sponsorCount)} sponsors →
          </Link>
        </div>

        {/* Column C — Lookup */}
        <div className="p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Is this company sponsoring in Ireland?
          </p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="search"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="Google, HSE, Meta…"
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
            <button
              type="submit"
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-teal-600 text-white px-3 py-2 text-sm font-medium hover:bg-teal-700"
            >
              <Search size={14} />
              Search
            </button>
          </form>

          <div className="mt-3 min-h-[4.5rem]">
            {searchState === 'idle' && (
              <p className="text-xs text-slate-400">
                Search the official {LATEST_YEAR} permit dataset.
              </p>
            )}
            {searchState === 'loading' && (
              <p className="text-xs text-slate-500 animate-pulse">Searching…</p>
            )}
            {searchState === 'active' && match && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-xs font-semibold text-emerald-800">
                  ✅ {match.employerName} — {formatIE(match.grandTotal)} permits in{' '}
                  {LATEST_YEAR}
                  {match.reliabilityTier && (
                    <span
                      className={`ml-1 inline-block px-1.5 rounded ${getTierBadgeClass(match.reliabilityTier)}`}
                    >
                      {getTierLabel(match.reliabilityTier)}
                    </span>
                  )}
                </p>
              </div>
            )}
            {searchState === 'inactive' && match && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs font-semibold text-amber-900">
                  ⚠️ {match.employerName} — no {LATEST_YEAR} permits
                  {lastSeenYear != null && ` · last seen ${lastSeenYear}`}
                </p>
              </div>
            )}
            {searchState === 'missing' && submitted && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2">
                <p className="text-xs font-semibold text-yellow-900">
                  ⚠️ Not in {LATEST_YEAR} dataset — check history
                </p>
                <p className="text-[10px] text-yellow-800 mt-1 leading-relaxed">
                  No employment permits were issued to this name in {LATEST_YEAR}. Check
                  other years on the analytics page.
                </p>
                <Link
                  to="/analytics"
                  className="text-[10px] font-semibold text-teal-700 hover:underline mt-1 inline-block"
                >
                  Check all years →
                </Link>
              </div>
            )}
          </div>

          {(searchState === 'active' || searchState === 'inactive') && (
            <div className="flex items-center gap-2 mt-3" aria-label="Recent year activity">
              {historyDots.map((d) => (
                <span
                  key={d.year}
                  title={`${d.year}: ${d.active ? formatIE(d.total) : 'no data'}`}
                  className={`h-3 w-3 rounded-full border ${
                    d.active
                      ? 'bg-teal-500 border-teal-600'
                      : 'bg-transparent border-slate-300'
                  }`}
                />
              ))}
              <span className="text-[10px] text-slate-400 ml-1">2022–2026</span>
            </div>
          )}
        </div>
      </div>

      <footer className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Updated {formatTimestamp(dash.snapshotDate ?? summary?.lastRefreshed)} · gov.ie
          official data
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1 hover:text-teal-700"
          >
            <RefreshCw size={12} />
            Refresh now
          </button>
          <a
            href="https://enterprise.gov.ie/en/What-We-Do/Workplace-and-Skills/Employment-Permits/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-teal-700"
          >
            Source
            <ExternalLink size={11} />
          </a>
          <Link to="/analytics" className="font-semibold text-teal-700 hover:underline">
            Full analytics →
          </Link>
        </div>
      </footer>
    </div>
  );
}
