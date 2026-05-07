import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Brain, Edit2, Save, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import EmptyState from '@/components/ui/EmptyState';
import {
  agentMemoryApi,
  type AgentMemorySearchResult,
  type CareerMemory,
} from '@/services/agentMemoryApi';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

type MemoryCategory = 'skills' | 'experience' | 'preferences' | 'personal' | 'goals' | 'other';

const MOCK_MEMORIES: CareerMemory[] = [
  {
    id: 'm-1',
    key: 'target-role',
    value: 'Target role: Senior Full Stack Developer (React + Node.js)',
    category: 'goals',
    source: 'onboarding',
    whySuggested: null,
    confidence: 100,
    memoryEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'm-2',
    key: 'core-skills',
    value: '4 years React experience, 3 years Node.js, 2 years Java',
    category: 'skills',
    source: 'cv',
    whySuggested: null,
    confidence: 100,
    memoryEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'm-3',
    key: 'work-style',
    value: 'Prefer hybrid roles in Dublin, open to fully remote',
    category: 'preferences',
    source: 'profile',
    whySuggested: null,
    confidence: 100,
    memoryEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'm-4',
    key: 'education',
    value: 'MSc Data Analytics @ NCI, graduating 2026',
    category: 'experience',
    source: 'manual',
    whySuggested: null,
    confidence: 100,
    memoryEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'm-5',
    key: 'notice',
    value: 'Notice period: 4 weeks',
    category: 'personal',
    source: 'manual',
    whySuggested: null,
    confidence: 100,
    memoryEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const CAT_COLORS: Record<MemoryCategory, string> = {
  skills: 'bg-emerald-100 text-emerald-700',
  experience: 'bg-blue-100 text-blue-700',
  preferences: 'bg-purple-100 text-purple-700',
  personal: 'bg-orange-100 text-orange-700',
  goals: 'bg-indigo-100 text-indigo-700',
  other: 'bg-gray-100 text-gray-600',
};

const getCategoryColor = (category: string) => CAT_COLORS[(category as MemoryCategory)] ?? CAT_COLORS.other;

const getSourceLabel = (source: CareerMemory['source']) => {
  switch (source) {
    case 'manual':
      return 'Manual';
    case 'auto':
      return 'AI';
    case 'cv':
      return 'CV';
    case 'profile':
      return 'Profile';
    case 'onboarding':
      return 'Onboarding';
    default:
      return 'Unknown';
  }
};

const isSearchResult = (value: unknown): value is AgentMemorySearchResult =>
  typeof value === 'object' && value !== null;

const hasSearchResults = (value: unknown): value is { results: AgentMemorySearchResult[] } =>
  isSearchResult(value)
  && Array.isArray(value.results)
  && value.results.every(isSearchResult);

const getSearchResultLabel = (result: AgentMemorySearchResult) => {
  const content = result.content;
  if (typeof content === 'string') return content;

  const document = result.document;
  if (typeof document === 'string') return document;

  const text = result.text;
  if (typeof text === 'string') return text;

  return JSON.stringify(result);
};

const createMemoryKey = (category: MemoryCategory, content: string) => {
  const stem = content
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32);

  return `${category}-${stem || 'memory'}-${Date.now()}`;
};

const MemoryRow = ({
  mem,
  onToggle,
  onDelete,
  onSave,
}: {
  mem: CareerMemory;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, value: string) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mem.value);

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 ${!mem.memoryEnabled ? 'opacity-50' : ''}`}>
      <button onClick={() => onToggle(mem.id)} className="shrink-0 mt-0.5 text-gray-400 hover:text-indigo-500 transition-colors">
        {mem.memoryEnabled ? <ToggleRight size={18} className="text-indigo-500" /> : <ToggleLeft size={18} />}
      </button>
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            autoFocus
            value={value}
            onChange={event => setValue(event.target.value)}
            rows={2}
            aria-label="Edit memory content"
            placeholder="Edit memory content"
            className="w-full px-2.5 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
        ) : (
          <p className="text-sm text-gray-900">{mem.value}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${getCategoryColor(mem.category)}`}>{mem.category}</span>
          <span className="text-[10px] text-gray-400">{getSourceLabel(mem.source)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button aria-label="Save memory" title="Save memory" onClick={() => { onSave(mem.id, value); setEditing(false); }} className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50"><Save size={13} /></button>
            <button aria-label="Cancel editing" title="Cancel editing" onClick={() => { setValue(mem.value); setEditing(false); }} className="p-1.5 rounded text-gray-400 hover:bg-gray-50"><X size={13} /></button>
          </>
        ) : (
          <>
            <button aria-label="Edit memory" title="Edit memory" onClick={() => setEditing(true)} className="p-1.5 rounded text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"><Edit2 size={13} /></button>
            <button aria-label="Delete memory" title="Delete memory" onClick={() => onDelete(mem.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
          </>
        )}
      </div>
    </div>
  );
};

const AgentMemoryPage = () => {
  const [memories, setMemories] = useState<CareerMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all');
  const [newContent, setNewContent] = useState('');
  const [newCat, setNewCat] = useState<MemoryCategory>('other');
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AgentMemorySearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(resolve => setTimeout(resolve, 400));
          setMemories(MOCK_MEMORIES);
          return;
        }

        const response = await agentMemoryApi.list().catch(() => ({
          memories: MOCK_MEMORIES,
          total: MOCK_MEMORIES.length,
        }));
        setMemories(response.memories);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleToggle = async (id: string) => {
    const current = memories.find(memory => memory.id === id);
    if (!current) return;

    const nextEnabled = !current.memoryEnabled;

    try {
      if (!USE_MOCKS) await agentMemoryApi.toggle(id, nextEnabled);
      setMemories(prev => prev.map(memory => memory.id === id ? { ...memory, memoryEnabled: nextEnabled } : memory));
    } catch {
      toast.error('Failed to toggle memory.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!USE_MOCKS) await agentMemoryApi.delete(id);
      setMemories(prev => prev.filter(memory => memory.id !== id));
      toast.success('Memory deleted.');
    } catch {
      toast.error('Failed to delete memory.');
    }
  };

  const handleSave = async (id: string, value: string) => {
    const current = memories.find(memory => memory.id === id);
    if (!current) return;

    try {
      const updated = USE_MOCKS
        ? { ...current, value, updatedAt: new Date().toISOString() }
        : await agentMemoryApi.upsert({
            category: current.category,
            key: current.key,
            value,
            source: current.source ?? 'manual',
            whySuggested: current.whySuggested,
            confidence: current.confidence,
          });
      setMemories(prev => prev.map(memory => memory.id === id ? updated : memory));
      toast.success('Memory updated.');
    } catch {
      toast.error('Failed to update memory.');
    }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) {
      toast.error('Memory content required.');
      return;
    }

    setAdding(true);
    try {
      const key = createMemoryKey(newCat, newContent);
      const memory = USE_MOCKS
        ? {
            id: `m-${Date.now()}`,
            key,
            value: newContent,
            category: newCat,
            source: 'manual' as const,
            whySuggested: null,
            confidence: 100,
            memoryEnabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : await agentMemoryApi.upsert({
            category: newCat,
            key,
            value: newContent,
            source: 'manual',
            confidence: 100,
          });
      setMemories(prev => [memory, ...prev]);
      setNewContent('');
      toast.success('Memory added.');
    } catch {
      toast.error('Failed to add memory.');
    } finally {
      setAdding(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Search query is required.');
      return;
    }

    setSearching(true);
    setSearchResults([]);

    try {
      const results = await agentMemoryApi.search(searchQuery);
      if (Array.isArray(results)) {
        setSearchResults(results.filter(isSearchResult));
      } else if (hasSearchResults(results)) {
        setSearchResults(results.results);
      } else {
        toast.error('No results returned.');
      }
    } catch (error: unknown) {
      const message = typeof error === 'object'
        && error !== null
        && 'response' in error
        && typeof error.response === 'object'
        && error.response !== null
        && 'data' in error.response
        && typeof error.response.data === 'object'
        && error.response.data !== null
        && 'error' in error.response.data
        && typeof error.response.data.error === 'string'
        ? error.response.data.error
        : 'Failed to query local agentmemory daemon.';
      toast.error(message);
    } finally {
      setSearching(false);
    }
  };

  const visible = filter === 'all'
    ? memories
    : memories.filter(memory => memory.category === filter);
  const categories: (MemoryCategory | 'all')[] = ['all', 'skills', 'experience', 'preferences', 'personal', 'goals', 'other'];

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading memories...</div>;
  }

  return (
    <>
      <PageMeta title="Agent Memory - CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Memory</h1>
          <p className="text-sm text-gray-500 mt-1">Facts the AI uses when generating cover letters, outreach messages and evaluations. Toggle to enable or disable each one.</p>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-800">Semantic Memory Search</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Query the local agent-memory daemon directly (for example, Spring Boot or JWT auth)..."
              className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 bg-white border border-indigo-100 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">Matched Contexts:</p>
              {searchResults.map((result, index) => (
                <div key={index} className="p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-800">
                  {getSearchResultLabel(result)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                filter === category ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? `All (${memories.length})` : category}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {visible.length === 0 ? (
            <EmptyState
              icon={<Brain size={28} className="text-slate-300" />}
              message="No memories in this category"
              description="Add a memory below, or switch to a different category filter."
            />
          ) : (
            visible.map(memory => (
              <MemoryRow
                key={memory.id}
                mem={memory}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSave={handleSave}
              />
            ))
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Add a Memory</p>
          <textarea
            value={newContent}
            onChange={event => setNewContent(event.target.value)}
            rows={2}
            placeholder="e.g. I have 3 years experience leading agile teams..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <div className="flex gap-2">
            <select
              value={newCat}
              onChange={event => setNewCat(event.target.value as MemoryCategory)}
              aria-label="Memory category"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {(['skills', 'experience', 'preferences', 'personal', 'goals', 'other'] as MemoryCategory[]).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {adding ? 'Adding...' : 'Add Memory'}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">How Agent Memory works</p>
          <p className="text-xs text-blue-700">These facts are injected into AI prompts when you run Skills like Evaluate, Outreach, and Cover Letter. Disabling a memory prevents it from being included. The AI also auto-creates memories from your CV and profile - you can edit or delete any of them.</p>
        </div>
      </div>
    </>
  );
};

export default AgentMemoryPage;