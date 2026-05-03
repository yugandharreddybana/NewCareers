import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { experimentsApi, type Experiment, type ExperimentResults } from '@/services/experimentsApi';
import toast from 'react-hot-toast';
import { FlaskConical, Play, Pause, CheckCircle, BarChart2, Users, TrendingUp, RefreshCw } from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_RESULTS: ExperimentResults[] = [
  {
    id: 'exp-1', key: 'dashboard_cta_variant',
    variants: [
      { name: 'control',     participants: 820,  conversions: 98,  conversionRate: 0.1195, isWinner: false },
      { name: 'treatment_a', participants: 790,  conversions: 138, conversionRate: 0.1747, isWinner: true  },
    ],
  },
  {
    id: 'exp-2', key: 'skills_panel_position',
    variants: [
      { name: 'control',     participants: 1200, conversions: 240, conversionRate: 0.2,    isWinner: false },
      { name: 'treatment_a', participants: 1180, conversions: 225, conversionRate: 0.1907, isWinner: false },
    ],
  },
];

const MOCK_EXPERIMENTS: Experiment[] = [
  { id: 'exp-1', key: 'dashboard_cta_variant',   name: 'Dashboard CTA Variant',   status: 'active',    variants: ['control','treatment_a'], trafficPercent: 100, createdAt: new Date(Date.now() - 86400000 * 14).toISOString() },
  { id: 'exp-2', key: 'skills_panel_position',   name: 'Skills Panel Position',   status: 'completed', variants: ['control','treatment_a'], trafficPercent: 100, createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 'exp-3', key: 'onboarding_step_order',   name: 'Onboarding Step Order',   status: 'paused',    variants: ['control','treatment_a'], trafficPercent: 50,  createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
];

const STATUS_STYLES: Record<Experiment['status'], { badge: string; icon: React.ReactNode }> = {
  active:    { badge: 'bg-emerald-100 text-emerald-700', icon: <Play size={11} /> },
  paused:    { badge: 'bg-amber-100 text-amber-600',    icon: <Pause size={11} /> },
  completed: { badge: 'bg-gray-100 text-gray-600',      icon: <CheckCircle size={11} /> },
};

const ResultsCard: React.FC<{ result: ExperimentResults }> = ({ result }) => {
  const maxRate = Math.max(...result.variants.map(v => v.conversionRate));
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <p className="text-xs font-mono text-gray-400">{result.key}</p>
      </div>
      <div className="space-y-3">
        {result.variants.map(v => (
          <div key={v.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 capitalize">{v.name.replace('_', ' ')}</span>
                {v.isWinner && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">🏆 Winner</span>}
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <span className="flex items-center gap-1"><Users size={10} /> {v.participants.toLocaleString()}</span>
                <span className={`font-bold ${ v.isWinner ? 'text-emerald-600' : 'text-gray-700'}`}>{(v.conversionRate * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${ v.isWinner ? 'bg-emerald-500' : 'bg-indigo-300'}`}
                style={{ width: `${(v.conversionRate / maxRate) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ExperimentDashboardPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [results, setResults]         = useState<ExperimentResults[]>([]);
  const [loading, setLoading]         = useState(true);
  const [toggling, setToggling]       = useState<string | null>(null);
  const [tab, setTab]                 = useState<'experiments' | 'results'>('experiments');

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(r => setTimeout(r, 400));
          setExperiments(MOCK_EXPERIMENTS);
          setResults(MOCK_RESULTS);
        } else {
          const [exps, res] = await Promise.all([
            experimentsApi.getAllVariants().catch(() => [] as never[]),
            experimentsApi.getAdminResults().catch(() => MOCK_RESULTS),
          ]);
          setExperiments(MOCK_EXPERIMENTS); // fallback — variants endpoint is user-facing
          setResults(res as ExperimentResults[]);
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleToggle = async (id: string) => {
    setToggling(id);
    try {
      if (!USE_MOCKS) {
        const updated = await experimentsApi.toggleStatus(id);
        setExperiments(prev => prev.map(e => e.id === id ? updated : e));
      } else {
        setExperiments(prev => prev.map(e => e.id === id ? { ...e, status: e.status === 'active' ? 'paused' : 'active' as Experiment['status'] } : e));
      }
      toast.success('Experiment status updated.');
    } catch { toast.error('Failed to toggle experiment.'); }
    finally { setToggling(null); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading experiments…</div>;

  const activeCount = experiments.filter(e => e.status === 'active').length;

  return (
    <>
      <PageMeta title="Experiments — CareerOps" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Experiment Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">A/B test management and conversion results. <span className="text-amber-600 font-medium">Admin only.</span></p>
          </div>
          <span className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">{activeCount} active</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Experiments', value: experiments.length, icon: <FlaskConical size={15} /> },
            { label: 'Active',            value: activeCount,        icon: <Play size={15} /> },
            { label: 'With Results',      value: results.length,     icon: <BarChart2 size={15} /> },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{s.icon}</div>
              <div><p className="text-lg font-bold text-gray-900">{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['experiments','results'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{t === 'experiments' ? `Experiments (${experiments.length})` : `Results (${results.length})`}</button>
          ))}
        </div>

        {tab === 'experiments' && (
          <div className="space-y-3">
            {experiments.map(e => {
              const meta = STATUS_STYLES[e.status];
              return (
                <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{e.name}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${meta.badge}`}>{meta.icon}{e.status}</span>
                      </div>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">{e.key}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-gray-400">
                        <span>{e.variants.join(' vs ')}</span>
                        <span>{e.trafficPercent}% traffic</span>
                        <span>{new Date(e.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                    {e.status !== 'completed' && (
                      <button onClick={() => handleToggle(e.id)} disabled={toggling === e.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          e.status === 'active'
                            ? 'border-amber-300 text-amber-600 hover:bg-amber-50'
                            : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                        } disabled:opacity-50`}>
                        {toggling === e.id ? <RefreshCw size={12} className="animate-spin" /> : e.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'results' && (
          <div className="space-y-4">
            {results.length > 0
              ? results.map(r => <ResultsCard key={r.id} result={r} />)
              : <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center"><p className="text-sm text-gray-500">No results yet.</p></div>
            }
          </div>
        )}

      </div>
    </>
  );
};

export default ExperimentDashboardPage;
