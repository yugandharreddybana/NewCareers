import { useEffect, useState, useCallback } from 'react';
import { agentMemoryApi, type CareerMemory } from '@/api/agentMemoryApi';
import toast from 'react-hot-toast';
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

const CATEGORIES = [
  { id: '',                  label: 'All' },
  { id: 'role_goal',         label: 'Role Goals' },
  { id: 'salary_goal',       label: 'Salary' },
  { id: 'industry',          label: 'Industry' },
  { id: 'preferred_company', label: 'Company Type' },
  { id: 'writing_tone',      label: 'Writing Tone' },
  { id: 'outreach_tone',     label: 'Outreach Tone' },
  { id: 'skill',             label: 'Skills' },
  { id: 'other',             label: 'Other' },
];

export default function AgentMemoryPage() {
  const [memories, setMemories]   = useState<CareerMemory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState({ category: 'other', key: '', value: '', whySuggested: '' });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const data = await agentMemoryApi.list(catFilter || undefined);
      setMemories(data.memories);
    } catch {
      toast.error('Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.key.trim() || !form.value.trim()) return;
    try {
      const m = await agentMemoryApi.upsert(form);
      setMemories(prev => {
        const idx = prev.findIndex(x => x.id === m.id);
        return idx >= 0 ? prev.map((x, i) => i === idx ? m : x) : [m, ...prev];
      });
      setCreating(false);
      setForm({ category: 'other', key: '', value: '', whySuggested: '' });
      toast.success('Memory saved');
    } catch {
      toast.error('Failed to save memory');
    }
  }

  async function handleToggle(m: CareerMemory) {
    try {
      const updated = await agentMemoryApi.toggle(m.id, !m.memoryEnabled);
      setMemories(prev => prev.map(x => x.id === m.id ? updated : x));
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this memory?')) return;
    try {
      await agentMemoryApi.delete(id);
      setMemories(prev => prev.filter(m => m.id !== id));
      toast.success('Removed');
    } catch {
      toast.error('Failed to remove');
    }
  }

  async function handleResetAll() {
    if (!confirm('Reset ALL memories? This cannot be undone.')) return;
    try {
      await agentMemoryApi.resetAll();
      setMemories([]);
      toast.success('All memories cleared');
    } catch {
      toast.error('Failed to reset');
    }
  }

  // Group by category
  const grouped = memories.reduce<Record<string, CareerMemory[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  const confidenceColor = (c: number) =>
    c >= 85 ? 'text-green-600' : c >= 70 ? 'text-yellow-600' : 'text-slate-400';

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Brain size={22} className="text-brand-500" />
            Agent Memory
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            What the AI knows about your career preferences — toggle to exclude from context
          </p>
        </div>
        <div className="flex items-center gap-2">
          {memories.length > 0 && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-2 px-3 py-2 border border-danger-300 text-danger-600
                         rounded-lg text-sm font-medium hover:bg-danger-50 transition-colors"
            >
              <RotateCcw size={14} />
              Reset All
            </button>
          )}
          <button
            onClick={() => setCreating(c => !c)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg
                       text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <Plus size={16} />
            Add Memory
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCatFilter(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              catFilter === c.id
                ? 'bg-brand-500 text-white'
                : 'bg-surface-raised text-text-secondary hover:bg-surface-overlay'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate}
              className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-text-primary">Add Memory</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Category</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.filter(c => c.id).map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Key *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. target_title"
                value={form.key}
                onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-text-tertiary mb-1 block">Value *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Senior Software Engineer"
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-text-tertiary mb-1 block">Why suggested (optional)</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Set in your profile goals"
                value={form.whySuggested}
                onChange={e => setForm(f => ({ ...f, whySuggested: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit"
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium
                               hover:bg-brand-600 transition-colors">
              Save
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
        <div className="text-center py-16 text-text-tertiary">Loading memories…</div>
      ) : memories.length === 0 ? (
        <div className="text-center py-16">
          <Brain size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">No memories yet</p>
          <p className="text-sm text-text-tertiary mt-1">
            The AI will build these from your activity and profile data.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => {
            const label = CATEGORIES.find(c => c.id === cat)?.label ?? cat;
            const isOpen = !collapsed[cat];
            return (
              <div key={cat} className="bg-white border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setCollapsed(c => ({ ...c, [cat]: isOpen }))}
                  className="w-full flex items-center justify-between px-4 py-3
                             hover:bg-surface-raised transition-colors text-left"
                >
                  <span className="font-semibold text-sm text-text-primary">{label}</span>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </button>
                {isOpen && (
                  <div className="divide-y divide-border">
                    {items.map(m => (
                      <div key={m.id}
                           className={`px-4 py-3 flex items-start gap-3 ${
                             !m.memoryEnabled ? 'opacity-40' : ''
                           }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-text-tertiary">{m.key}</span>
                            <span className={`text-[10px] font-semibold ${confidenceColor(m.confidence)}`}>
                              {m.confidence}%
                            </span>
                          </div>
                          <p className="text-sm text-text-primary mt-0.5">{m.value}</p>
                          {m.whySuggested && (
                            <p className="text-[11px] text-text-tertiary mt-1 italic">
                              {m.whySuggested}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggle(m)}
                            className="p-1.5 text-text-tertiary hover:text-brand-500 transition-colors"
                            title={m.memoryEnabled ? 'Disable' : 'Enable'}
                          >
                            {m.memoryEnabled
                              ? <ToggleRight size={16} className="text-brand-500" />
                              : <ToggleLeft  size={16} />}
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 text-text-tertiary hover:text-danger-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
