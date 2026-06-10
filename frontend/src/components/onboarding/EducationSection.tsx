import { DegreeCombobox } from '@/components/onboarding/DegreeCombobox';
import type { MappedEducationEntry } from '@/lib/mapCvParseToOnboarding';

type Props = {
  entries: MappedEducationEntry[];
  onChange: (index: number, patch: Partial<MappedEducationEntry>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function EducationPanel({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: MappedEducationEntry;
  index: number;
  onChange: (index: number, patch: Partial<MappedEducationEntry>) => void;
  onRemove?: () => void;
}) {
  const id = (field: string) => `edu-${index}-${field}`;

  return (
    <div className="onboarding-panel">
      <div className="onboarding-field onboarding-field--muted" style={{ marginBottom: '1.5rem' }}>
        <label htmlFor={id('schoolName')}>School / University</label>
        <input
          className="onboarding-input-sm"
          id={id('schoolName')}
          placeholder="e.g. State University"
          type="text"
          value={entry.schoolName}
          onChange={e => onChange(index, { schoolName: e.target.value })}
        />
      </div>

      <div className="onboarding-grid-3">
        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('degree')}>Degree</label>
          <DegreeCombobox
            id={id('degree')}
            degreeLevel={entry.degreeLevel}
            degreeTitle={entry.degreeTitle}
            fieldOfStudy={entry.fieldOfStudy}
            onChange={patch => onChange(index, patch)}
          />
        </div>
        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('fieldOfStudy')}>Field of Study</label>
          <input
            className="onboarding-input-sm"
            id={id('fieldOfStudy')}
            placeholder="e.g. Computer Science"
            type="text"
            value={entry.fieldOfStudy}
            onChange={e => onChange(index, { fieldOfStudy: e.target.value })}
          />
        </div>
        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('startYear')}>Start year</label>
          <input
            className="onboarding-input-sm"
            id={id('startYear')}
            type="number"
            min={1950}
            max={2100}
            placeholder="e.g. 2016"
            value={entry.startYear}
            onChange={e => onChange(index, { startYear: e.target.value })}
          />
        </div>
        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('endYear')}>End year</label>
          <input
            className="onboarding-input-sm"
            id={id('endYear')}
            type="number"
            min={1950}
            max={2100}
            placeholder="e.g. 2020"
            value={entry.endYear}
            onChange={e =>
              onChange(index, {
                endYear: e.target.value,
                graduationYear: e.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="onboarding-field onboarding-field--muted" style={{ marginTop: '1.5rem' }}>
        <label htmlFor={id('location')}>Location</label>
        <input
          className="onboarding-input-sm"
          id={id('location')}
          placeholder="e.g. Dublin, Ireland"
          type="text"
          value={entry.location}
          onChange={e => onChange(index, { location: e.target.value })}
        />
      </div>

      {onRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            className="onboarding-panel__delete"
            onClick={onRemove}
            aria-label="Remove school"
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

export function EducationSection({ entries, onChange, onAdd, onRemove }: Props) {
  return (
    <>
      {entries.map((entry, i) => (
        <EducationPanel
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
        Add another school
      </button>
    </>
  );
}
