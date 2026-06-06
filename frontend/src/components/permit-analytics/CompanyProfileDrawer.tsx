import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { X, Bookmark, ExternalLink } from 'lucide-react';
import { useCompanyProfile } from '@/hooks/usePermitAnalytics';
import {
  formatReliabilityScore,
  getScoreColor,
  getTierBadgeClass,
  getTierDescription,
  getTierLabel,
} from '@/utils/reliabilityUtils';
import { formatIE, formatPct } from './format';
import { PanelSkeleton } from './PanelSkeleton';
import { MONTH_FIELDS } from './constants';
import type { PermitCompany } from '@/services/permitAnalyticsService';

interface Props {
  normalisedName: string | null;
  selectedYear: number | 'all';
  onClose: () => void;
  inWatchlist: boolean;
  onToggleWatchlist: () => void;
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const color = score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" className="fill-slate-900 text-sm font-bold">
        {formatReliabilityScore(score)}
      </text>
    </svg>
  );
}

export function CompanyProfileDrawer({
  normalisedName,
  selectedYear,
  onClose,
  inWatchlist,
  onToggleWatchlist,
}: Props) {
  const { data, isLoading } = useCompanyProfile(normalisedName ?? '');

  const historyChart = useMemo(() => {
    if (!data?.yearHistory?.length) return [];
    return data.yearHistory.map((p) => ({
      year: p.year,
      total: p.grandTotal,
      rank: p.rankThatYear,
    }));
  }, [data?.yearHistory]);

  const monthlyChart = useMemo(() => {
    const c: PermitCompany | undefined = data?.current;
    if (!c) return [];
    return MONTH_FIELDS.map((m) => ({
      month: m.label,
      value: c[m.key as keyof PermitCompany] as number | null,
    })).filter((row) => row.value != null);
  }, [data?.current]);

  const monthlyAvg = useMemo(() => {
    const vals = monthlyChart.map((m) => m.value ?? 0);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [monthlyChart]);

  const peakYear = useMemo(() => {
    const first = historyChart[0];
    if (!first) return null;
    return historyChart.reduce((best, p) => (p.total > best.total ? p : best), first);
  }, [historyChart]);

  const open = !!normalisedName;

  if (!open) return null;

  const rel = data?.reliability;
  const yearLabel = selectedYear === 'all' ? new Date().getFullYear() : selectedYear;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[480px] bg-white shadow-2xl flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Company profile"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <PanelSkeleton className="h-12 w-3/4" />
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">
                  {data?.current.employerName ?? normalisedName}
                </h2>
                {rel && (
                  <div className="mt-2 flex items-center gap-3">
                    <ScoreRing score={rel.reliabilityScore} />
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getTierBadgeClass(rel.reliabilityTier)}`}>
                        {getTierLabel(rel.reliabilityTier)}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        Active sponsor for {rel.yearsActive} of the last {rel.totalYearsInDataset} years
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {isLoading && <PanelSkeleton className="h-64" />}

          {!isLoading && rel && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Reliability at a glance</h3>
              <p className={`text-3xl font-bold ${getScoreColor(rel.reliabilityScore)}`}>
                {formatReliabilityScore(rel.reliabilityScore)}{' '}
                <span className="text-lg text-slate-400 font-normal">/ 100</span>
              </p>
              <p className="text-xs text-slate-600 mt-2">{getTierDescription(rel.reliabilityTier)}</p>
              <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-500">First seen</span><p className="font-semibold">{rel.firstSeenYear}</p></div>
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-500">Last seen</span><p className="font-semibold">{rel.lastSeenYear}</p></div>
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-500">Peak year</span><p className="font-semibold">{rel.peakYear ?? '—'} ({formatIE(rel.peakYearTotal ?? 0)})</p></div>
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-500">Avg / yr</span><p className="font-semibold">{rel.avgAnnualPermits != null ? formatIE(Math.round(rel.avgAnnualPermits)) : '—'}</p></div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-800 font-medium">
                  {rel.trend3yr.replace(/_/g, ' ')}
                </span>
                {rel.yoyChangePct != null && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${rel.yoyChangePct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {rel.yoyChangePct >= 0 ? '+' : ''}{formatPct(rel.yoyChangePct)} vs last full year
                  </span>
                )}
              </div>
            </section>
          )}

          {!isLoading && historyChart.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Year-by-year history</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatIE(Number(v))} />
                    <Tooltip
                      formatter={(v: number) => [formatIE(v), 'Permits']}
                      labelFormatter={(y) => `Year ${y}`}
                    />
                    <ReferenceLine x={2020} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'COVID-19', position: 'top', fontSize: 10 }} />
                    {peakYear && (
                      <ReferenceLine x={peakYear.year} stroke="#0d9488" strokeDasharray="2 2" label={{ value: 'Peak', fontSize: 10 }} />
                    )}
                    <Area type="monotone" dataKey="total" stroke="#0f766e" fill="#99f6e4" strokeWidth={2} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {!isLoading && monthlyChart.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Monthly breakdown ({yearLabel})</h3>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChart}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {monthlyChart.map((entry, idx) => (
                        <Cell
                          key={`m-${idx}`}
                          fill={(entry.value ?? 0) >= monthlyAvg ? '#0d9488' : '#94a3b8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {!isLoading && data?.current && (
            <section className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700">
              {data.current.grandTotal > 0 ? (
                <p>
                  This company was issued <strong>{formatIE(data.current.grandTotal)}</strong> permits in{' '}
                  <strong>{data.current.sourceYear}</strong>.
                </p>
              ) : (
                <p>
                  This company does not appear in the <strong>{yearLabel}</strong> permit dataset.
                </p>
              )}
            </section>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleWatchlist}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
          >
            <Bookmark size={16} className={inWatchlist ? 'fill-current' : ''} />
            {inWatchlist ? 'On watchlist' : 'Add to watchlist'}
          </button>
          <a
            href="https://enterprise.gov.ie/en/what-we-do/work-permits/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Source <ExternalLink size={14} />
          </a>
        </div>
      </aside>
    </>
  );
}
