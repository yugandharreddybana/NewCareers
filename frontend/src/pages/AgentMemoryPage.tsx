import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { agentMemoryApi, type AgentMemory, type MemoryCategory } from '@/services/agentMemoryApi';
import * as mocks from '@/services/mockApi';
import toast from 'react-hot-toast';
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight, Edit2, Save, X, Filter } from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_MEMORIES: AgentMemory[] = [
  { id: 'm-1', content: 'Target role: Senior Full Stack Developer (React + Node.js)', category: 'goals',      isEnabled: true,  source: 'onboarding', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm-2', content: '4 years React experience, 3 years Node.js, 2 years Java',  category: 'skills',     isEnabled: true,  source: 'cv',        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm-3', content: 'Prefer hybrid roles in Dublin, open to fully remote',       category: 'preferences', isEnabled: true,  source: 'profile',   createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm-4', content: 'MSc Data Analytics @ NCI, graduating 2026',                category: 'experience', isEnabled: true,  source: 'manual',    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'm-5', content: 'Notice period: 4 weeks',                                   category: 'personal',   isEnabled: false, source: 'manual',    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const CAT_COLORS: Record<MemoryCategory, string> = {
  skills:      'bg-emerald-100 text-emerald-700',
  experience:  'bg-blue-100 text-blue-700',
  preferences: 'bg-purple-100 text-purple-700',
  personal:    'bg-orange-100 text-orange-700',
  goals:       'bg-indigo-100 text-indigo-700',
  other:       'bg-gray-100 text-gray-600',
};

const SOURCE_LABEL: Record<AgentMemory['source'], string> = {
  manual: 'Manual',
  auto:   'AI',
  cv:     'CV',
};

const MemoryRow: React.FC<{
  mem: AgentMemory;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, content: string) => void;
}> = ({ mem, onToggle, onDelete, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(mem.content);

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 ${ !mem.isEnabled ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(mem.id)} className="shrink-0 mt-0.5 text-gray-400 hover:text-indigo-500 transition-colors">
        {mem.isEnabled ? <ToggleRight size={18} className="text-indigo-500" /> : <ToggleLeft size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea autoFocus value={val} onChange={e => setVal(e.target.value)} rows={2}
            className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
        ) : (
          <p className="text-sm text-gray-900">{mem.content}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${CAT_COLORS[mem.category]}`}>{mem.category}</span>
          <span className="text-[10px] text-gray-400">{SOURCE_LABEL[mem.source]}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button onClick={() => { onSave(mem.id, val); setEditing(false); }} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"><Save size={13} /></button>
            <button onClick={() => { setVal(mem.content); setEditing(false); }} className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><X size={13} /></button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"><Edit2 size={13} /></button>
            <button onClick={() => onDelete(mem.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  );
};

const AgentMemoryPage: React.FC = () => {
  const [memories, setMemories]       = useState<AgentMemory[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<MemoryCategory | 'all'>('all');
  const [newContent, setNewContent]   = useState('');
  const [newCat, setNewCat]           = useState<MemoryCategory>('other');
  const [adding, setAdding]           = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) { await new Promise(r => setTimeout(r, 400)); setMemories(MOCK_MEMORIES); }
        else { const d = await agentMemoryApi.getAll().catch(() => MOCK_MEMORIES); setMemories(d); }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      if (!USE_MOCKS) await agentMemoryApi.toggle(id);
      setMemories(prev => prev.map(m => m.id === id ? { ...m, isEnabled: !m.isEnabled } : m));
    } catch { toast.error('Failed to toggle memory.'); }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!USE_MOCKS) await agentMemoryApi.delete(id);
      setMemories(prev => prev.filter(m => m.id !== id));
      toast.success('Memory deleted.');
    } catch { toast.error('Failed to delete memory.'); }
  };

  const handleSave = async (id: string, content: string) => {
    try {
      if (!USE_MOCKS) await agentMemoryApi.update(id, { content });
      setMemories(prev => prev.map(m => m.id === id ? { ...m, content } : m));
      toast.success('Memory updated.');
    } catch { toast.error('Failed to update memory.'); }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) { toast.error('Memory content required.'); return; }
    setAdding(true);
    try {
      const m = USE_MOCKS
        ? { id: `m-${Date.now()}`, content: newContent, category: newCat, isEnabled: true, source: 'manual' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : await agentMemoryApi.upsert({ content: newContent, category: newCat });
      setMemories(prev => [m, ...prev]);
      setNewContent(''); toast.success('Memory added.');
    } catch { toast.error('Failed to add memory.'); }
    finally { setAdding(false); }
  };

  const visible = filter === 'all' ? memories : memories.filter(m => m.category === filter);
  const cats: (MemoryCategory | 'all')[] = ['all', 'skills', 'experience', 'preferences', 'personal', 'goals', 'other'];

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading memories…</div>;

  return (
    <>
      <PageMeta title="Agent Memory — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Memory</h1>
          <p className="text-sm text-gray-500 mt-1">Facts the AI uses when generating cover letters, outreach messages and evaluations. Toggle to enable or disable each one.</p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                filter === c ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{c === 'all' ? `All (${memories.length})` : c}</button>
          ))}
        </div>

        {/* Memory list */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {visible.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No memories in this category.</p> :
            visible.map(m => <MemoryRow key={m.id} mem={m} onToggle={handleToggle} onDelete={handleDelete} onSave={handleSave} />)
          }
        </div>

        {/* Add new */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Add a Memory</p>
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={2}
            placeholder="e.g. I have 3 years experience leading agile teams…"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          <div className="flex gap-2">
            <select value={newCat} onChange={e => setNewCat(e.target.value as MemoryCategory)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {(['skills','experience','preferences','personal','goals','other'] as MemoryCategory[]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleAdd} disabled={adding}
              className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              {adding ? 'Adding…' : 'Add Memory'}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">💡 How Agent Memory works</p>
          <p className="text-xs text-blue-700">These facts are injected into AI prompts when you run Skills like Evaluate, Outreach, and Cover Letter. Disabling a memory prevents it from being included. The AI also auto-creates memories from your CV and profile — you can edit or delete any of them.</p>
        </div>
      </div>
    </>
  );
};

export default AgentMemoryPage;
