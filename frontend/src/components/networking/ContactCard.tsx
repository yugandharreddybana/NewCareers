import { useState } from 'react';
import { type NetworkContact, type LogInteractionPayload, networkingApi } from '@/api/networkingApi';
import { toast } from 'sonner';

const TEMP_COLOURS: Record<string, string> = {
  cold: 'bg-blue-100 text-blue-700',
  warm: 'bg-amber-100 text-amber-700',
  hot:  'bg-red-100  text-red-700',
};

const STAGE_LABELS: Record<string, string> = {
  identified:        'Identified',
  connected:         'Connected',
  outreached:        'Outreached',
  replied:           'Replied',
  meeting_scheduled: 'Meeting Booked',
  closed:            'Closed',
};

interface Props {
  contact: NetworkContact;
  onUpdated: () => void;
}

export default function ContactCard({ contact, onUpdated }: Props) {
  const [logging, setLogging] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [form, setForm] = useState<LogInteractionPayload>({
    interactionType: 'email',
    outcome: 'no_response',
    notes: '',
    nextStep: '',
    nextStepDueDate: '',
  });

  const handleLog = async () => {
    try {
      setLogging(true);
      await networkingApi.logInteraction(contact.id, form);
      toast.success('Interaction logged');
      setShowLog(false);
      onUpdated();
    } catch {
      toast.error('Failed to log interaction');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-text">{contact.name}</p>
          {contact.company && (
            <p className="text-sm text-text-muted">
              {contact.roleTitle ? `${contact.roleTitle} · ` : ''}{contact.company}
            </p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TEMP_COLOURS[contact.relationshipTemperature]}`}>
          {contact.relationshipTemperature}
        </span>
      </div>

      {/* Pipeline stage */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-faint uppercase tracking-wide">Stage</span>
        <span className="text-xs font-medium text-primary">
          {STAGE_LABELS[contact.pipelineStage] ?? contact.pipelineStage}
        </span>
      </div>

      {/* Last interaction */}
      {contact.lastInteraction && (
        <p className="text-xs text-text-muted">
          Last: {contact.lastInteraction.interactionType.replace('_', ' ')}
          {contact.lastInteraction.nextStep && (
            <span className="ml-1 text-warning">→ {contact.lastInteraction.nextStep}</span>
          )}
        </p>
      )}

      {/* LinkedIn shortcut */}
      {contact.linkedinUrl && (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline underline-offset-2"
        >
          View LinkedIn ↗
        </a>
      )}

      {/* Log interaction toggle */}
      <button
        onClick={() => setShowLog(v => !v)}
        className="mt-1 text-xs font-medium text-primary hover:underline text-left"
      >
        {showLog ? '− Cancel' : '+ Log Interaction'}
      </button>

      {showLog && (
        <div className="flex flex-col gap-2 border-t border-divider pt-3">
          <select
            className="input-sm"
            value={form.interactionType}
            onChange={e => setForm(f => ({ ...f, interactionType: e.target.value as LogInteractionPayload['interactionType'] }))}
          >
            {['linkedin_message','email','call','meeting','follow_up'].map(t => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            className="input-sm"
            value={form.outcome}
            onChange={e => setForm(f => ({ ...f, outcome: e.target.value as LogInteractionPayload['outcome'] }))}
          >
            {['no_response','positive','negative','meeting_booked'].map(o => (
              <option key={o} value={o}>{o.replace('_', ' ')}</option>
            ))}
          </select>
          <textarea
            className="input-sm resize-none"
            rows={2}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <input
            className="input-sm"
            placeholder="Next step"
            value={form.nextStep}
            onChange={e => setForm(f => ({ ...f, nextStep: e.target.value }))}
          />
          <input
            type="date"
            className="input-sm"
            value={form.nextStepDueDate}
            onChange={e => setForm(f => ({ ...f, nextStepDueDate: e.target.value }))}
          />
          <button
            disabled={logging}
            onClick={handleLog}
            className="btn-primary text-xs py-1.5"
          >
            {logging ? 'Saving…' : 'Save Interaction'}
          </button>
        </div>
      )}
    </div>
  );
}
