import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { watchlistsApi, type Watchlist } from '@/services/watchlistsApi';
import * as mocks from '@/services/mockApi';
import toast from 'react-hot-toast';
import {
  Bell, BellOff, Plus, Trash2, Search,
  MapPin, DollarSign, Zap, Clock, RefreshCw,
  ToggleLeft, ToggleRight, ChevronRight,
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_WATCHLISTS: Watchlist[] = [
  { id: 'wl-1', name: 'Dublin Senior React Roles', query: 'React TypeScript senior', location: 'Dublin', salaryMin: 70000, salaryMax: null, isActive: true,  lastRunAt: new Date(Date.now() - 3600000).toISOString(), matchCount: 8,  createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'wl-2', name: 'Remote Full Stack €80k+',  query: 'Node.js full stack',     location: null,     salaryMin: 80000, salaryMax: null, isActive: true,  lastRunAt: new Date(Date.now() - 7200000).toISOString(),  matchCount: 3,  createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 'wl-3', name: 'Tech Lead Cork',            query: 'tech lead engineering',  location: 'Cork',   salaryMin: null,  salaryMax: null, isActive: false, lastRunAt: null, matchCount: 0, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const MOCK_SUGGESTIONS = [
  { query: 'Senior Full Stack Developer React TypeScript', location: 'Dublin' },
  { query: 'Node.js Backend Engineer microservices', location: null },
  { query: 'Java Spring Boot developer fintech', location: 'Dublin' },
];

function fmtSalary(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => `€${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `up to ${fmt(max!!)}`;
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Never run';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Create modal ──────────────────────────────────────────────────────────────
const CreateModal: React.FC<{ onClose: () => void; onCreate: (w: Watchlist) => void }> = ({ onClose, onCreate }) => {
  const [name, setName]       = useState('');
  const [query, setQuery]     = useState('');
  const [location, setLoc]    = useState('');
  const [salaryMin, setSalMin] = useState('');
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !query.trim()) { toast.error('Name and search query are required.'); return; }
    setSaving(true);
    try {
      const w = USE_MOCKS
        ? { id: `wl-${Date.now()}`, name, query, location: location || null, salaryMin: salaryMin ? +salaryMin : null, salaryMax: null, isActive: true, lastRunAt: null, matchCount: 0, createdAt: new Date().toISOString() }
        : await watchlistsApi.create({ name, query, location: location || undefined, salaryMin: salaryMin ? +salaryMin : undefined });
      onCreate(w);
      toast.success('Watchlist created!');
      onClose();
    } catch { toast.error('Failed to create watchlist.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">New Watchlist</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dublin Senior React Roles" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Search Query</label>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. React TypeScript senior" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Location (optional)</label>
            <input value={location} onChange={e => setLoc(e.target.value)} placeholder="e.g. Dublin" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Min Salary €</label>
            <input type="number" value={salaryMin} onChange={e => setSalMin(e.target.value)} placeholder="70000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Create Watchlist'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Watchlist card ────────────────────────────────────────────────────────────
const WatchlistCard: React.FC<{
  wl: Watchlist;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}> = ({ wl, onToggle, onDelete, deleting }) => (
  <div className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${ wl.isActive ? 'border-indigo-200' : 'border-gray-200'}`}>
    <div className="flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ wl.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
        {wl.isActive ? <Bell size={16} /> : <BellOff size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">{wl.name}</p>
          {wl.isActive && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">Active</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Search size={11} /> {wl.query}</p>
        <div className="flex flex-wrap gap-3 mt-2">
          {wl.location && <span className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin size={10} />{wl.location}</span>}
          {fmtSalary(wl.salaryMin, wl.salaryMax) && <span className="text-[11px] text-gray-400 flex items-center gap-1"><DollarSign size={10} />{fmtSalary(wl.salaryMin, wl.salaryMax)}</span>}
          <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={10} />{relativeTime(wl.lastRunAt)}</span>
          {wl.matchCount > 0 && <span className="text-[11px] text-indigo-500 font-semibold">{wl.matchCount} match{wl.matchCount !== 1 ? 'es' : ''}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onToggle(wl.id)} title={wl.isActive ? 'Pause' : 'Activate'}
          className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          {wl.isActive ? <ToggleRight size={17} className="text-indigo-500" /> : <ToggleLeft size={17} />}
        </button>
        <button onClick={() => onDelete(wl.id)} disabled={deleting} title="Delete"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const WatchlistsPage: React.FC = () => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [suggestions, setSuggestions] = useState<{ query: string; location: string | null }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting]  = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(r => setTimeout(r, 500));
          setWatchlists(MOCK_WATCHLISTS);
          setSuggestions(MOCK_SUGGESTIONS);
        } else {
          const [wls, sugs] = await Promise.all([
            watchlistsApi.getAll().catch(() => MOCK_WATCHLISTS),
            watchlistsApi.getSuggestions().catch(() => []),
          ]);
          setWatchlists(wls);
          setSuggestions(sugs);
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      if (!USE_MOCKS) await watchlistsApi.toggle(id);
      setWatchlists(prev => prev.map(w => w.id === id ? { ...w, isActive: !w.isActive } : w));
      toast.success('Watchlist updated.');
    } catch { toast.error('Failed to toggle watchlist.'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this watchlist?')) return;
    setDeleting(id);
    try {
      if (!USE_MOCKS) await watchlistsApi.delete(id);
      setWatchlists(prev => prev.filter(w => w.id !== id));
      toast.success('Watchlist deleted.');
    } catch { toast.error('Failed to delete watchlist.'); }
    finally { setDeleting(null); }
  };

  const handleAddSuggestion = (s: { query: string; location: string | null }) => {
    const newWl: Watchlist = {
      id: `wl-${Date.now()}`, name: s.query.slice(0, 40), query: s.query,
      location: s.location, salaryMin: null, salaryMax: null,
      isActive: true, lastRunAt: null, matchCount: 0, createdAt: new Date().toISOString(),
    };
    setWatchlists(prev => [newWl, ...prev]);
    toast.success('Watchlist added from suggestion!');
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading watchlists…</div>;

  const activeCount = watchlists.filter(w => w.isActive).length;
  const totalMatches = watchlists.reduce((s, w) => s + w.matchCount, 0);

  return (
    <>
      <PageMeta title="Watchlists — CareerOps" />
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={w => setWatchlists(prev => [w, ...prev])} />}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Watchlists</h1>
            <p className="text-sm text-gray-500 mt-1">Saved searches that auto-deliver new matches to your pipeline.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} /> New Watchlist
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Watchlists', value: watchlists.length, icon: <Bell size={15} /> },
            { label: 'Active',           value: activeCount,       icon: <Zap size={15} /> },
            { label: 'Total Matches',    value: totalMatches,      icon: <ChevronRight size={15} /> },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{s.icon}</div>
              <div>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Watchlist cards */}
        {watchlists.length > 0 ? (
          <div className="space-y-3">
            {watchlists.map(wl => (
              <WatchlistCard key={wl.id} wl={wl} onToggle={handleToggle} onDelete={handleDelete} deleting={deleting === wl.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Bell size={28} className="text-slate-300" />}
            message="No watchlists yet"
            description="Create a saved search to get automatic job alerts delivered to your pipeline."
            cta="New Watchlist"
            onCta={() => setShowModal(true)}
          />
        )}

        {/* AI suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-indigo-800 mb-3">✨ Suggested Watchlists</h2>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm text-gray-800">{s.query}</p>
                    {s.location && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{s.location}</p>}
                  </div>
                  <button onClick={() => handleAddSuggestion(s)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                    <Plus size={13} /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default WatchlistsPage;
