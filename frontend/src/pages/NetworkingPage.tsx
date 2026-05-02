import { useEffect, useState, useCallback } from 'react';
import {
  networkingApi,
  type NetworkContact,
  type InteractionResponse,
  type ContactType,
} from '@/api/networkingApi';
import PipelineBoard from '@/components/networking/PipelineBoard';
import AddContactModal from '@/components/networking/AddContactModal';
import toast from 'react-hot-toast';

const TYPE_FILTERS: { value: ContactType | ''; label: string }[] = [
  { value: '',                label: 'All' },
  { value: 'recruiter',       label: 'Recruiters' },
  { value: 'hiring_manager',  label: 'Hiring Managers' },
  { value: 'alumni',          label: 'Alumni' },
  { value: 'referral',        label: 'Referrals' },
];

export default function NetworkingPage() {
  const [contacts, setContacts]     = useState<NetworkContact[]>([]);
  const [overdue, setOverdue]       = useState<InteractionResponse[]>([]);
  const [filter, setFilter]         = useState<ContactType | ''>('');
  const [showAdd, setShowAdd]       = useState(false);
  const [loading, setLoading]       = useState(true);

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
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            + Add Contact
          </button>
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
