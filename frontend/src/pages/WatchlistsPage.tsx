import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bell,
  BellOff,
  ChevronRight,
  Clock,
  DollarSign,
  MapPin,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Zap,
} from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { watchlistsApi, type Watchlist } from '@/services/watchlistsApi';

interface WatchlistSuggestion {
  query: string;
  location: string | null;
}

function fmtSalary(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const format = (value: number) => `€${(value / 1000).toFixed(0)}k`;
  if (min && max) return `${format(min)} - ${format(max)}`;
  if (min) return `${format(min)}+`;
  return max ? `up to ${format(max)}` : null;
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Never run';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const CreateModal = ({ onClose, onCreate }: { onClose: () => void; onCreate: (watchlist: Watchlist) => void }) => {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !query.trim()) {
      toast.error('Name and search query are required.');
      return;
    }

    setSaving(true);
    try {
      const watchlist = await watchlistsApi.create({
        name,
        queryKeywords: query,
        location: location || null,
        minSalary: salaryMin ? Number(salaryMin) : null,
        status: 'active',
        alertEmail: true,
        alertInApp: true,
      });

      onCreate(watchlist);
      toast.success('Watchlist created!');
      onClose();
    } catch {
      toast.error('Failed to create watchlist.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900">New Watchlist</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Dublin Senior React Roles" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Search Query</label>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. React TypeScript senior" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Location (optional)</label>
            <input value={location} onChange={event => setLocation(event.target.value)} placeholder="e.g. Dublin" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Min Salary €</label>
            <input type="number" value={salaryMin} onChange={event => setSalaryMin(event.target.value)} placeholder="70000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Creating...' : 'Create Watchlist'}
          </button>
        </div>
      </div>
    </div>
  );
};

const WatchlistCard = ({
  watchlist,
  onToggle,
  onDelete,
  deleting,
}: {
  watchlist: Watchlist;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) => {
  const isActive = watchlist.status === 'active';
  const queryText = watchlist.queryKeywords ?? 'No keywords set';

  return (
    <div className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${isActive ? 'border-indigo-200' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
          {isActive ? <Bell size={16} /> : <BellOff size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{watchlist.name}</p>
            {isActive && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">Active</span>}
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Search size={11} /> {queryText}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {watchlist.location && <span className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin size={10} />{watchlist.location}</span>}
            {fmtSalary(watchlist.minSalary, watchlist.maxSalary) && <span className="text-[11px] text-gray-400 flex items-center gap-1"><DollarSign size={10} />{fmtSalary(watchlist.minSalary, watchlist.maxSalary)}</span>}
            <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={10} />{relativeTime(watchlist.lastRunAt)}</span>
            {watchlist.matchedTotal > 0 && <span className="text-[11px] text-indigo-500 font-semibold">{watchlist.matchedTotal} match{watchlist.matchedTotal !== 1 ? 'es' : ''}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button aria-label={isActive ? 'Pause watchlist' : 'Activate watchlist'} title={isActive ? 'Pause watchlist' : 'Activate watchlist'} onClick={() => onToggle(watchlist.id)} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
            {isActive ? <ToggleRight size={17} className="text-indigo-500" /> : <ToggleLeft size={17} />}
          </button>
          <button aria-label="Delete watchlist" onClick={() => onDelete(watchlist.id)} disabled={deleting} title="Delete watchlist" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

const WatchlistsPage = () => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [suggestions, setSuggestions] = useState<WatchlistSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [watchlistResponse, suggestionResponse] = await Promise.all([
          watchlistsApi.list(),
          watchlistsApi.getSuggestions(),
        ]);
        setWatchlists(watchlistResponse.watchlists);
        setSuggestions(suggestionResponse.map(query => ({ query, location: null })));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const updated = await watchlistsApi.toggle(id);
      if (!updated) return;

      setWatchlists(prev => prev.map(watchlist => watchlist.id === id ? updated : watchlist));
      toast.success('Watchlist updated.');
    } catch {
      toast.error('Failed to toggle watchlist.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this watchlist?')) return;

    setDeleting(id);
    try {
      await watchlistsApi.delete(id);
      setWatchlists(prev => prev.filter(watchlist => watchlist.id !== id));
      toast.success('Watchlist deleted.');
    } catch {
      toast.error('Failed to delete watchlist.');
    } finally {
      setDeleting(null);
    }
  };

  const handleAddSuggestion = async (suggestion: WatchlistSuggestion) => {
    try {
      const created = await watchlistsApi.create({
        name: suggestion.query.slice(0, 40),
        queryKeywords: suggestion.query,
        location: suggestion.location,
        status: 'active',
        alertEmail: true,
        alertInApp: true,
      });
      setWatchlists(prev => [created, ...prev]);
      toast.success('Watchlist added from suggestion!');
    } catch {
      toast.error('Failed to add suggested watchlist.');
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const activeCount = watchlists.filter(watchlist => watchlist.status === 'active').length;
  const totalMatches = watchlists.reduce((sum, watchlist) => sum + watchlist.matchedTotal, 0);

  return (
    <>
      <PageMeta title="Watchlists - NewCareers" />
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={watchlist => setWatchlists(prev => [watchlist, ...prev])} />}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Watchlists</h1>
            <p className="text-sm text-gray-500 mt-1">Saved searches that auto-deliver new matches to your pipeline.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} /> New Watchlist
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Watchlists', value: watchlists.length, icon: <Bell size={15} /> },
            { label: 'Active', value: activeCount, icon: <Zap size={15} /> },
            { label: 'Total Matches', value: totalMatches, icon: <ChevronRight size={15} /> },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{stat.icon}</div>
              <div>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <p className="text-[10px] text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {watchlists.length > 0 ? (
          <div className="space-y-3">
            {watchlists.map(watchlist => (
              <WatchlistCard key={watchlist.id} watchlist={watchlist} onToggle={handleToggle} onDelete={handleDelete} deleting={deleting === watchlist.id} />
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

        {suggestions.length > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-indigo-800 mb-3">Suggested Watchlists</h2>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm text-gray-800">{suggestion.query}</p>
                    {suggestion.location && <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10} />{suggestion.location}</p>}
                  </div>
                  <button onClick={() => void handleAddSuggestion(suggestion)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
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