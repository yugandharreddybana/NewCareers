import { type NetworkContact } from '@/api/networkingApi';
import ContactCard from './ContactCard';

const STAGES = [
  { key: 'identified',        label: 'Identified' },
  { key: 'connected',         label: 'Connected' },
  { key: 'outreached',        label: 'Outreached' },
  { key: 'replied',           label: 'Replied' },
  { key: 'meeting_scheduled', label: 'Meeting Booked' },
  { key: 'closed',            label: 'Closed' },
];

interface Props {
  contacts: NetworkContact[];
  onUpdated: () => void;
}

export default function PipelineBoard({ contacts, onUpdated }: Props) {
  const byStage = (stage: string) =>
    contacts.filter(c => c.pipelineStage === stage);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map(({ key, label }) => {
        const cols = byStage(key);
        return (
          <div key={key} className="flex-shrink-0 w-64">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text">{label}</h3>
              <span className="text-xs bg-surface-offset text-text-muted rounded-full px-2 py-0.5">
                {cols.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {cols.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-xs text-text-faint text-center">
                  No contacts
                </div>
              ) : (
                cols.map(c => (
                  <ContactCard key={c.id} contact={c} onUpdated={onUpdated} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
