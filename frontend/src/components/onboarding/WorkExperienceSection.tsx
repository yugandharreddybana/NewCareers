import { MonthYearField } from '@/components/onboarding/MonthYearField';
import type { MappedWorkEntry } from '@/lib/mapCvParseToOnboarding';

type Props = {
  entries: MappedWorkEntry[];
  onChange: (index: number, patch: Partial<MappedWorkEntry>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function WorkPanel({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: MappedWorkEntry;
  index: number;
  onChange: (index: number, patch: Partial<MappedWorkEntry>) => void;
  onRemove?: () => void;
}) {
  const id = (field: string) => `work-${index}-${field}`;

  return (
    <div className="onboarding-panel">
      <div className="onboarding-grid-2">
        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('jobTitle')}>Job Title</label>
          <input
            className="onboarding-input-sm"
            id={id('jobTitle')}
            placeholder="e.g. Software Engineer"
            type="text"
            value={entry.jobTitle}
            onChange={e => onChange(index, { jobTitle: e.target.value })}
          />
        </div>
        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('companyName')}>Company Name</label>
          <input
            className="onboarding-input-sm"
            id={id('companyName')}
            placeholder="e.g. Acme Corp"
            type="text"
            value={entry.companyName}
            onChange={e => onChange(index, { companyName: e.target.value })}
          />
        </div>
      </div>

      <div className="onboarding-grid-2" style={{ marginTop: '1.5rem' }}>
        <MonthYearField
          label="Start Date"
          idPrefix={id('start')}
          value={entry.startDate}
          onChange={next => onChange(index, { startDate: next })}
        />
        <MonthYearField
          label="End Date"
          idPrefix={id('end')}
          value={entry.endDate}
          disabled={entry.current}
          onChange={next => onChange(index, { endDate: next })}
          {...(entry.current ? { hint: 'Leave blank while you still work here' } : {})}
        />
      </div>

      <div className="onboarding-field onboarding-field--muted" style={{ marginTop: '1.5rem' }}>
        <label htmlFor={id('location')}>Location</label>
        <input
          className="onboarding-input-sm"
          id={id('location')}
          placeholder="e.g. Dublin, Ireland or Remote"
          type="text"
          value={entry.location}
          onChange={e => onChange(index, { location: e.target.value })}
        />
      </div>

      <div className="onboarding-checkbox-row" style={{ marginTop: '1rem' }}>
        <input
          id={id('current')}
          type="checkbox"
          checked={entry.current}
          onChange={e =>
            onChange(index, { current: e.target.checked, endDate: e.target.checked ? '' : entry.endDate })
          }
        />
        <label htmlFor={id('current')}>I currently work here</label>
      </div>

      <div className="onboarding-field onboarding-field--muted">
        <label htmlFor={id('description')}>Description</label>
        <textarea
          className="onboarding-input-sm"
          id={id('description')}
          rows={3}
          placeholder="Describe your responsibilities and achievements..."
          value={entry.description}
          onChange={e => onChange(index, { description: e.target.value })}
          style={{ resize: 'none' }}
        />
      </div>

      {onRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            className="onboarding-panel__delete"
            onClick={onRemove}
            aria-label="Remove position"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export function WorkExperienceSection({ entries, onChange, onAdd, onRemove }: Props) {
  const filled = entries.filter(e => e.jobTitle.trim() || e.companyName.trim()).length;

  return (
    <>
      {entries.map((entry, i) => (
        <WorkPanel
          key={i}
          entry={entry}
          index={i}
          onChange={onChange}
          {...(i > 0 ? { onRemove: () => onRemove(i) } : {})}
        />
      ))}
      <button type="button" className="onboarding-btn-text-add" onClick={onAdd}>
        <span className="material-symbols-outlined" aria-hidden="true">
          add
        </span>
        Add another position
      </button>
      <span className="sr-only">{filled} work entries filled</span>
    </>
  );
}
