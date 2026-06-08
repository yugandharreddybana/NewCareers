import type { MappedProjectEntry } from '@/lib/mapCvParseToOnboarding';

type Props = {
  entries: MappedProjectEntry[];
  onChange: (index: number, patch: Partial<MappedProjectEntry>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

function ProjectPanel({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: MappedProjectEntry;
  index: number;
  onChange: (index: number, patch: Partial<MappedProjectEntry>) => void;
  onRemove?: () => void;
}) {
  const id = (field: string) => `project-${index}-${field}`;

  return (
    <div className="onboarding-panel">
      <div className="onboarding-panel__stack">
        <div className="onboarding-grid-2">
          <div className="onboarding-field onboarding-field--muted">
            <label htmlFor={id('projectName')}>Project Name</label>
            <input
              className="onboarding-input-sm"
              id={id('projectName')}
              placeholder="e.g. CareerOps"
              type="text"
              value={entry.projectName}
              onChange={e => onChange(index, { projectName: e.target.value })}
            />
          </div>
          <div className="onboarding-field onboarding-field--muted">
            <label htmlFor={id('projectLink')}>Project Link</label>
            <input
              className="onboarding-input-sm"
              id={id('projectLink')}
              placeholder="GitHub or live demo URL"
              type="url"
              value={entry.projectLink}
              onChange={e => onChange(index, { projectLink: e.target.value })}
            />
          </div>
        </div>

        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('location')}>Location</label>
          <input
            className="onboarding-input-sm"
            id={id('location')}
            placeholder="e.g. Remote or Dublin"
            type="text"
            value={entry.location}
            onChange={e => onChange(index, { location: e.target.value })}
          />
        </div>

        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('techStack')}>Tech stack</label>
          <input
            className="onboarding-input-sm"
            id={id('techStack')}
            placeholder="e.g. React, Node.js, PostgreSQL"
            type="text"
            value={entry.techStack}
            onChange={e => onChange(index, { techStack: e.target.value })}
          />
        </div>

        <div className="onboarding-field onboarding-field--muted">
          <label htmlFor={id('projectDetails')}>Project details</label>
          <textarea
            className="onboarding-input-sm"
            id={id('projectDetails')}
            rows={3}
            placeholder="Describe what you built and your role..."
            value={entry.projectDetails}
            onChange={e => onChange(index, { projectDetails: e.target.value })}
            style={{ resize: 'none' }}
          />
        </div>
      </div>

      {onRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            className="onboarding-panel__delete"
            onClick={onRemove}
            aria-label="Remove project"
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

export function ProjectsSection({ entries, onChange, onAdd, onRemove }: Props) {
  return (
    <>
      {entries.map((entry, i) => (
        <ProjectPanel
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
        Add another project
      </button>
    </>
  );
}
