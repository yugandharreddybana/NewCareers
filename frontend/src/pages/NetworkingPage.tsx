import { useEffect, useState, useCallback, useRef } from 'react';
import {
  networkingApi,
  type NetworkContact,
  type InteractionResponse,
  type ContactType,
} from '@/api/networkingApi';
import PipelineBoard from '@/components/networking/PipelineBoard';
import AddContactModal from '@/components/networking/AddContactModal';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

const DUMMY_CONTACTS: NetworkContact[] = [
  {
    id: 'c-1',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@techwave.ie',
    linkedinUrl: 'https://linkedin.com/in/sarahjenkins',
    company: 'TechWave Ireland',
    roleTitle: 'Technical Recruiter',
    contactType: 'recruiter',
    relationshipTemperature: 'warm',
    pipelineStage: 'connected',
    notes: 'Very responsive about front-end roles.',
    linkedUserJobId: 'uj-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastInteraction: {
      id: 'i-1',
      interactionType: 'linkedin_message',
      outcome: 'positive',
      nextStep: 'Send tailored resume',
      nextStepDueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  },
  {
    id: 'c-2',
    name: 'Michael Chen',
    email: 'mchen@ecogrowth.com',
    linkedinUrl: 'https://linkedin.com/in/michaelchen',
    company: 'EcoGrowth',
    roleTitle: 'Engineering Manager',
    contactType: 'hiring_manager',
    relationshipTemperature: 'cold',
    pipelineStage: 'identified',
    notes: 'Looking to hire Full Stack developers.',
    linkedUserJobId: 'uj-2',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastInteraction: null
  }
];

const TYPE_FILTERS: { value: ContactType | ''; label: string }[] = [
  { value: '',                label: 'All' },
  { value: 'recruiter',       label: 'Recruiters' },
  { value: 'hiring_manager',  label: 'Hiring Managers' },
  { value: 'alumni',          label: 'Alumni' },
  { value: 'referral',        label: 'Referrals' },
];

export default function NetworkingPage() {
  const [contacts, setContacts]       = useState<NetworkContact[]>(DUMMY_CONTACTS);
  const [overdue, setOverdue]         = useState<InteractionResponse[]>([]);
  const [filter, setFilter]           = useState<ContactType | ''>('');
  const [showAdd, setShowAdd]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [importing, setImporting]     = useState(false);
  const csvInputRef                   = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [res, od] = await Promise.all([
        networkingApi.getContacts(filter || undefined),
        networkingApi.getOverdue(),
      ]);
      setContacts(res.contacts);
      setOverdue(od);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset so same file can be re-selected
    e.target.value = '';
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ imported: number; skipped: number; errors: string[] }>(
        '/networking/contacts/import', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const { imported, skipped, errors } = res.data;
      if (imported > 0) {
        toast.success(`Imported ${imported} contact${imported !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} skipped` : ''}`);
        load();
      } else {
        toast.error(errors[0] ?? 'No contacts were imported');
      }
    } catch {
      toast.error('CSV import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-text">Networking</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
              {overdue.length > 0 && (
                <span className="ml-2 text-warning font-medium">
                  · {overdue.length} overdue follow-up{overdue.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="btn-secondary"
              title="Import contacts from CSV (columns: name,email,company,role_title,contact_type,linkedin_url,notes)"
            >
              {importing ? 'Importing…' : '⬆ Import CSV'}
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              + Add Contact
            </button>
          </div>
        </div>

        {/* Overdue banner */}
        {overdue.length > 0 && (
          <div className="rounded-xl bg-warning-highlight border border-warning/20 px-4 py-3 mb-6">
            <p className="text-sm font-medium text-warning">
              ⏰ You have {overdue.length} overdue follow-up{overdue.length !== 1 ? 's' : ''} — check your pipeline.
            </p>
          </div>
        )}

        {/* Type filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === value
                  ? 'bg-primary text-text-inverse'
                  : 'bg-surface-offset text-text-muted hover:bg-surface-dynamic'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pipeline board */}
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64">
                <div className="skeleton skeleton-heading mb-3" />
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="skeleton rounded-xl h-28 mb-3" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <PipelineBoard contacts={contacts} onUpdated={load} />
        )}
      </div>

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
