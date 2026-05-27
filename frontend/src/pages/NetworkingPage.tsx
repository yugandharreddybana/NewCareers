import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Users, Plus, Search, Mail, ExternalLink, Trash2, X } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  company: string | null;
  roleTitle: string | null;
  email: string | null;
  linkedinUrl: string | null;
  contactType: 'recruiter' | 'hiring_manager' | 'peer' | 'mentor' | 'other';
  relationshipTemperature: 'cold' | 'warm' | 'hot';
  pipelineStage: 'identified' | 'outreached' | 'replied' | 'meeting' | 'closed';
  notes: string | null;
}

const TEMP_STYLES = {
  cold: 'bg-blue-100 text-blue-600',
  warm: 'bg-amber-100 text-amber-600',
  hot:  'bg-red-100 text-red-600',
};

const STAGE_STYLES: Record<Contact['pipelineStage'], string> = {
  identified: 'bg-gray-100 text-gray-600',
  outreached: 'bg-indigo-100 text-indigo-600',
  replied:    'bg-blue-100 text-blue-700',
  meeting:    'bg-emerald-100 text-emerald-700',
  closed:     'bg-purple-100 text-purple-700',
};

const AddContactModal: React.FC<{ onClose: () => void; onAdd: (c: Contact) => void }> = ({ onClose, onAdd }) => {
  const [form, setForm] = useState({ name: '', company: '', roleTitle: '', email: '', linkedinUrl: '', contactType: 'recruiter' as Contact['contactType'], relationshipTemperature: 'cold' as Contact['relationshipTemperature'], pipelineStage: 'identified' as Contact['pipelineStage'], notes: '' });
  const [saving, setSaving] = useState(false);
  const textFields = [
    ['name', 'Name *'],
    ['company', 'Company'],
    ['roleTitle', 'Role / Title'],
    ['email', 'Email'],
    ['linkedinUrl', 'LinkedIn URL'],
  ] as const;
  const selectFields = [
    ['contactType', 'Type', ['recruiter', 'hiring_manager', 'peer', 'mentor', 'other'] as const],
    ['relationshipTemperature', 'Temperature', ['cold', 'warm', 'hot'] as const],
    ['pipelineStage', 'Stage', ['identified', 'outreached', 'replied', 'meeting', 'closed'] as const],
  ] as const;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      const body = { ...form, company: form.company || null, roleTitle: form.roleTitle || null, email: form.email || null, linkedinUrl: form.linkedinUrl || null, notes: form.notes || null };
      const c: Contact = await api.post('/networking/contacts', body).then(r => r.data);
      onAdd(c); toast.success('Contact added!'); onClose();
    } catch { toast.error('Failed to add contact.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between"><h2 className="text-base font-bold text-gray-900">Add Contact</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button></div>
        {textFields.map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input value={form[key]} onChange={e => set(key, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          {selectFields.map(([key, label, options]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <select value={form[key]} onChange={e => set(key, e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none">
                {options.map(option => <option key={option} value={option}>{option.replace('_',' ')}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" /></div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg">{saving ? 'Saving…' : 'Add Contact'}</button>
        </div>
      </div>
    </div>
  );
};

const NetworkingPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get('/networking/contacts').then(r => r.data);
        setContacts(data as Contact[]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this contact?')) return;
    setDeleting(id);
    try {
      await api.delete(`/networking/contacts/${id}`);
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contact removed.');
    } catch { toast.error('Failed to remove contact.'); }
    finally { setDeleting(null); }
  };

  const filtered = contacts.filter(c =>
    !search || [c.name, c.company, c.roleTitle].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <PageLoader />;

  return (
    <>
      <PageMeta title="Networking — CareerOps" />
      {showModal && <AddContactModal onClose={() => setShowModal(false)} onAdd={c => setContacts(prev => [c, ...prev])} />}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold text-gray-900">Networking</h1><p className="text-sm text-gray-500 mt-1">Track your recruiter and hiring manager relationships.</p></div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors"><Plus size={15} /> Add Contact</button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Contacts', value: contacts.length },
            { label: 'Warm / Hot',     value: contacts.filter(c => c.relationshipTemperature !== 'cold').length },
            { label: 'Replied',        value: contacts.filter(c => ['replied','meeting'].includes(c.pipelineStage)).length },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Contact cards */}
        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map(c => (
              <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full capitalize ${TEMP_STYLES[c.relationshipTemperature]}`}>{c.relationshipTemperature}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full capitalize ${STAGE_STYLES[c.pipelineStage]}`}>{c.pipelineStage}</span>
                  </div>
                  {(c.roleTitle || c.company) && <p className="text-xs text-gray-500 mt-0.5">{[c.roleTitle, c.company].filter(Boolean).join(' @ ')}</p>}
                  {c.notes && <p className="text-xs text-gray-400 mt-1 italic">{c.notes}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {c.email && <a href={`mailto:${c.email}`} className="text-gray-400 hover:text-indigo-500 transition-colors"><Mail size={14} /></a>}
                    {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 transition-colors"><ExternalLink size={14} /></a>}
                  </div>
                </div>
                <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
            <Users size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">{search ? 'No contacts match your search.' : 'No contacts yet. Add your first to start tracking.'}</p>
          </div>
        )}
      </div>
    </>
  );
};

export default NetworkingPage;
