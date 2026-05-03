import { useEffect, useState, useCallback } from 'react';
import { watchlistApi, type Watchlist } from '@/api/watchlistApi';
import toast from 'react-hot-toast';
import { Bell, BellOff, Plus, Trash2, MapPin, Wifi, WifiOff, Sparkles } from 'lucide-react';

const EMPTY: Watchlist = {
  id: '',
  name: '',
  queryKeywords: '',
  location: '',
  minSalary: null,
  maxSalary: null,
  remoteOnly: false,
  sponsorshipRequired: false,
  minMatchScore: 60,
  alertEmail: true,
  alertInApp: true,
  status: 'active',
  lastRunAt: null,
  matchedTotal: 0,
  clickedTotal: 0,
  appliedTotal: 0,
  createdAt: '',
  updatedAt: '',
};

export default function WatchlistsPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await watchlistApi.list();
      setWatchlists(data.watchlists);
    } catch {
      toast.error('Failed to load watchlists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    watchlistApi.getSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const created = await watchlistApi.create({
        name: form.name,
        queryKeywords: form.queryKeywords ?? '',
        location: form.location ?? '',
        remoteOnly: form.remoteOnly,
        minMatchScore: form.minMatchScore,
        alertEmail: form.alertEmail,
        alertInApp: form.alertInApp,
      });
      setWatchlists(prev => [created, ...prev]);
      setCreating(false);
      setForm(EMPTY);
      toast.success('Watchlist created');
    } catch {
      toast.error('Failed to create watchlist');
    }
  }

  async function handleToggle(id: string) {
    try {
      const updated = await watchlistApi.toggle(id);
      setWatchlists(prev => prev.map(w => w.id === id ? updated : w));
      toast.success(updated.status === 'active' ? 'Watchlist activated' : 'Watchlist paused');
    } catch {
      toast.error('Failed to toggle watchlist');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this watchlist?')) return;
    try {
      await watchlistApi.delete(id);
      setWatchlists(prev => prev.filter(w => w.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  const active = watchlists.filter(w => w.status === 'active');
  const paused = watchlists.filter(w => w.status === 'paused');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Job Watchlists</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Saved searches that auto-match new jobs every 6 hours
          </p>
        </div>
        <button
          onClick={() => setCreating(c => !c)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg
                     text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} />
          New Watchlist
        </button>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && !creating && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-brand-700 flex items-center gap-1.5 mb-2">
            <Sparkles size={12} /> Smart Query Suggestions (from your profile)
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setForm(f => ({ ...f, queryKeywords: s }));
                  setCreating(true);
                }}
                className="px-3 py-1.5 bg-white border border-brand-200 rounded-full text-xs
                           text-brand-700 hover:bg-brand-100 transition-colors font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate}
              className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-text-primary">Create Watchlist</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-text-tertiary mb-1 block">Name *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Senior Backend Engineer – Dublin"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Keywords</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="Java Spring Boot Postgres"
                value={form.queryKeywords ?? ''}
                onChange={e => setForm(f => ({ ...f, queryKeywords: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Location</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="Dublin, Ireland"
                value={form.location ?? ''}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">
                Min Match Score: {form.minMatchScore}%
              </label>
              <input
                type="range" min={40} max={95} step={5}
                value={form.minMatchScore}
                onChange={e => setForm(f => ({ ...f, minMatchScore: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-4 pt-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.remoteOnly}
                       onChange={e => setForm(f => ({ ...f, remoteOnly: e.target.checked }))} />
                Remote only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.alertEmail}
                       onChange={e => setForm(f => ({ ...f, alertEmail: e.target.checked }))} />
                Email alerts
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit"
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium
                               hover:bg-brand-600 transition-colors">
              Create
            </button>
            <button type="button" onClick={() => setCreating(false)}
                    className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-raised
                               transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-16 text-text-tertiary">Loading watchlists…</div>
      ) : watchlists.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">No watchlists yet</p>
          <p className="text-sm text-text-tertiary mt-1">
            Create a watchlist to get alerted when matching jobs appear.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {[{ label: 'Active', items: active }, { label: 'Paused', items: paused }].map(
            ({ label, items }) =>
              items.length > 0 && (
                <div key={label}>
                  <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                    {label} ({items.length})
                  </p>
                  <div className="space-y-3">
                    {items.map(w => (
                      <WatchlistCard
                        key={w.id}
                        watchlist={w}
                        onToggle={() => handleToggle(w.id)}
                        onDelete={() => handleDelete(w.id)}
                      />
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}

function WatchlistCard({
  watchlist: w,
  onToggle,
  onDelete,
}: {
  watchlist: Watchlist;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${
      w.status === 'paused' ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-primary text-sm">{w.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              w.status === 'active'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {w.status}
            </span>
            {w.remoteOnly && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                Remote
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-text-tertiary flex-wrap">
            {w.queryKeywords && <span className="font-mono">{w.queryKeywords}</span>}
            {w.location && (
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {w.location}
              </span>
            )}
            <span>≥{w.minMatchScore}% match</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-brand-500 hover:bg-brand-50 transition-colors"
            title={w.status === 'active' ? 'Pause' : 'Activate'}
          >
            {w.status === 'active' ? <BellOff size={15} /> : <Bell size={15} />}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-danger-500 hover:bg-danger-50 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center gap-6 text-xs text-text-tertiary">
        <span><strong className="text-text-primary">{w.matchedTotal}</strong> matched</span>
        <span><strong className="text-text-primary">{w.clickedTotal}</strong> clicked</span>
        <span><strong className="text-text-primary">{w.appliedTotal}</strong> applied</span>
        {w.lastRunAt && (
          <span className="ml-auto">
            Last run {new Date(w.lastRunAt).toLocaleDateString()}
          </span>
        )}
        {w.alertEmail ? (
          <Wifi size={12} className="text-green-500" title="Email alerts on" />
        ) : (
          <WifiOff size={12} className="text-slate-400" title="Email alerts off" />
        )}
      </div>
    </div>
  );
}
