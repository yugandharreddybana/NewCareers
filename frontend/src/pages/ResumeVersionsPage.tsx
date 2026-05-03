import { useEffect, useState, useCallback } from 'react';
import { resumeVersionApi, type ResumeVersion, type CompareResult } from '@/api/resumeVersionApi';
import toast from 'react-hot-toast';
import { FileText, Plus, Star, Trash2, CheckCircle, Tag, GitCompare, Lightbulb } from 'lucide-react';

const OUTCOME_OPTS = ['unknown', 'rejection', 'interview', 'offer'];
const OUTCOME_COLORS: Record<string, string> = {
  interview: 'bg-blue-100 text-blue-700',
  offer:     'bg-green-100 text-green-700',
  rejection: 'bg-red-100 text-red-700',
  unknown:   'bg-slate-100 text-slate-500',
};

export default function ResumeVersionsPage() {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm]         = useState({
    name: '',
    source: 'manual',
    roleTags: '',
    isActive: false,
    isFavorite: false,
    notes: '',
    bestForRoleType: '',
  });
  const [compareLeft, setCompareLeft]   = useState('');
  const [compareRight, setCompareRight] = useState('');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing, setComparing]       = useState(false);
  const [recommend, setRecommend]       = useState<{ recommended: ResumeVersion; reason: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await resumeVersionApi.list();
      setVersions(data.versions);
    } catch {
      toast.error('Failed to load resume versions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const created = await resumeVersionApi.create({
        name: form.name,
        source: form.source,
        roleTags: form.roleTags ? form.roleTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        isActive: form.isActive,
        isFavorite: form.isFavorite,
        notes: form.notes || undefined,
        bestForRoleType: form.bestForRoleType || undefined,
      });
      setVersions(prev => [created, ...prev]);
      setCreating(false);
      setForm({ name: '', source: 'manual', roleTags: '', isActive: false, isFavorite: false, notes: '', bestForRoleType: '' });
      toast.success('Version created');
    } catch {
      toast.error('Failed to create version');
    }
  }

  async function handleOutcome(id: string, outcome: string) {
    try {
      const updated = await resumeVersionApi.recordOutcome(id, outcome);
      setVersions(prev => prev.map(v => v.id === id ? updated : v));
      toast.success('Outcome recorded');
    } catch {
      toast.error('Failed to record outcome');
    }
  }

  async function handleToggleFavorite(v: ResumeVersion) {
    try {
      const updated = await resumeVersionApi.update(v.id, { isFavorite: !v.isFavorite });
      setVersions(prev => prev.map(x => x.id === v.id ? updated : x));
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleSetActive(id: string) {
    try {
      const updated = await resumeVersionApi.update(id, { isActive: true });
      setVersions(prev => prev.map(v => v.id === id ? updated : { ...v, isActive: false }));
      toast.success('Active version updated');
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleCompare() {
    if (!compareLeft || !compareRight || compareLeft === compareRight) {
      toast.error('Select two different versions to compare');
      return;
    }
    try {
      setComparing(true);
      const r = await resumeVersionApi.compare(compareLeft, compareRight);
      setCompareResult(r);
    } catch {
      toast.error('Compare failed');
    } finally {
      setComparing(false);
    }
  }

  async function handleRecommend() {
    try {
      const r = await resumeVersionApi.recommend();
      setRecommend(r);
      toast.success('Recommendation loaded');
    } catch {
      toast.error('No versions to recommend from');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this resume version?')) return;
    try {
      await resumeVersionApi.delete(id);
      setVersions(prev => prev.filter(v => v.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  const active    = versions.filter(v => v.isActive);
  const favorites = versions.filter(v => v.isFavorite && !v.isActive);
  const rest      = versions.filter(v => !v.isActive && !v.isFavorite);

  const groups = [
    { label: 'Active',    items: active    },
    { label: 'Favourites', items: favorites },
    { label: 'All',        items: rest      },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FileText size={22} className="text-brand-500" />
            Resume Versions
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            Track which CV version produced the best outcomes
          </p>
        </div>
        <button
          onClick={() => setCreating(c => !c)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg
                     text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} />
          New Version
        </button>
      </div>

      {/* Summary stats */}
      {versions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Versions', value: versions.length },
            { label: 'Total Interviews', value: versions.reduce((s, v) => s + v.interviewCount, 0) },
            { label: 'Total Offers',    value: versions.reduce((s, v) => s + v.offerCount, 0) },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-tertiary mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Compare + Recommend tools */}
      {versions.length >= 2 && (
        <div className="bg-white border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
              <GitCompare size={15} className="text-brand-500" />
              Compare Versions
            </h3>
            <button
              onClick={handleRecommend}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised text-text-secondary
                         rounded-lg text-xs font-medium hover:bg-surface-overlay transition-colors"
            >
              <Lightbulb size={12} className="text-yellow-500" />
              Recommend Best
            </button>
          </div>

          {recommend && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-yellow-800">
                Recommended: v{recommend.recommended.versionNumber} — {recommend.recommended.name}
              </p>
              <p className="text-yellow-700 text-xs mt-1">{recommend.reason}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <select
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm"
              value={compareLeft}
              onChange={e => setCompareLeft(e.target.value)}
            >
              <option value="">Select version A</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.versionNumber} — {v.name}</option>
              ))}
            </select>
            <span className="text-text-tertiary text-xs">vs</span>
            <select
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm"
              value={compareRight}
              onChange={e => setCompareRight(e.target.value)}
            >
              <option value="">Select version B</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>v{v.versionNumber} — {v.name}</option>
              ))}
            </select>
            <button
              onClick={handleCompare}
              disabled={comparing}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium
                         hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {comparing ? 'Comparing…' : 'Compare'}
            </button>
          </div>

          {compareResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[compareResult.left, compareResult.right].map(v => (
                  <div key={v.id} className="bg-surface-raised rounded-lg p-3">
                    <p className="font-semibold text-text-primary">v{v.versionNumber} — {v.name}</p>
                    <div className="mt-2 space-y-1 text-xs text-text-secondary">
                      <p>{v.applicationCount} apps · {v.interviewCount} interviews · {v.offerCount} offers</p>
                      {v.applicationCount > 0 && (
                        <p className="text-text-tertiary">
                          {Math.round((v.interviewCount / v.applicationCount) * 100)}% interview rate
                        </p>
                      )}
                      {v.bestForRoleType && <p className="text-text-tertiary">Best for: {v.bestForRoleType}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm text-brand-800">
                <p className="font-medium mb-1">Recommendation</p>
                <p className="text-xs">{compareResult.recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate}
              className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-text-primary">New Resume Version</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-text-tertiary mb-1 block">Name *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Backend Focus – v3 (AI)"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Source</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              >
                <option value="manual">Manual</option>
                <option value="skill_run">AI Skill Run</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">
                Role tags (comma-separated)
              </label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="backend, product"
                value={form.roleTags}
                onChange={e => setForm(f => ({ ...f, roleTags: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Best for role type</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Senior Backend Engineer"
                value={form.bestForRoleType}
                onChange={e => setForm(f => ({ ...f, bestForRoleType: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Notes</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="Quick note about this version"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="col-span-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isActive}
                       onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Set as active version
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isFavorite}
                       onChange={e => setForm(f => ({ ...f, isFavorite: e.target.checked }))} />
                Mark as favourite
              </label>
            </div>
          </div>
          <div className="flex gap-3">
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
        <div className="text-center py-16 text-text-tertiary">Loading…</div>
      ) : versions.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">No resume versions yet</p>
          <p className="text-sm text-text-tertiary mt-1">
            Track different CV versions to see which one gets more interviews.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(({ label, items }) =>
            items.length > 0 && (
              <div key={label}>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  {label} ({items.length})
                </p>
                <div className="space-y-3">
                  {items.map(v => (
                    <VersionCard
                      key={v.id}
                      version={v}
                      onFavorite={() => handleToggleFavorite(v)}
                      onSetActive={() => handleSetActive(v.id)}
                      onOutcome={(o) => handleOutcome(v.id, o)}
                      onDelete={() => handleDelete(v.id)}
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

function VersionCard({
  version: v,
  onFavorite,
  onSetActive,
  onOutcome,
  onDelete,
}: {
  version: ResumeVersion;
  onFavorite: () => void;
  onSetActive: () => void;
  onOutcome: (o: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${v.isActive ? 'border-brand-300 ring-1 ring-brand-200' : 'border-border'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-text-primary">
              v{v.versionNumber} — {v.name}
            </span>
            {v.isActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">
                Active
              </span>
            )}
            {v.outcomeAssociation && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                OUTCOME_COLORS[v.outcomeAssociation] ?? OUTCOME_COLORS.unknown
              }`}>
                {v.outcomeAssociation}
              </span>
            )}
            {v.source === 'skill_run' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                AI
              </span>
            )}
          </div>

          {v.roleTags?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Tag size={10} className="text-text-tertiary" />
              {v.roleTags.map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-surface-raised rounded text-text-secondary">
                  {t}
                </span>
              ))}
            </div>
          )}

          {v.notes && (
            <p className="text-xs text-text-tertiary mt-1.5 italic">{v.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onFavorite}
            className={`p-1.5 rounded-lg transition-colors ${
              v.isFavorite
                ? 'text-yellow-500 hover:text-yellow-600'
                : 'text-text-tertiary hover:text-yellow-500'
            }`}
            title={v.isFavorite ? 'Unfavourite' : 'Favourite'}
          >
            <Star size={15} fill={v.isFavorite ? 'currentColor' : 'none'} />
          </button>
          {!v.isActive && (
            <button
              onClick={onSetActive}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-brand-500 transition-colors"
              title="Set as active"
            >
              <CheckCircle size={15} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-danger-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center gap-6 text-xs text-text-tertiary flex-wrap">
        <span><strong className="text-text-primary">{v.applicationCount}</strong> apps</span>
        <span><strong className="text-text-primary">{v.interviewCount}</strong> interviews</span>
        <span><strong className="text-text-primary">{v.offerCount}</strong> offers</span>

        {v.applicationCount > 0 && (
          <span className="text-text-secondary">
            {Math.round((v.interviewCount / v.applicationCount) * 100)}% interview rate
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-text-tertiary">Record:</span>
          {OUTCOME_OPTS.map(o => (
            <button
              key={o}
              onClick={() => onOutcome(o)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                v.outcomeAssociation === o
                  ? OUTCOME_COLORS[o]
                  : 'bg-surface-raised text-text-tertiary hover:bg-surface-overlay'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
