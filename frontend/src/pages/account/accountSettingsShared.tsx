import { useId, useMemo, useState } from 'react';
import type { OnboardingEducationEntry, OnboardingWorkEntry } from '@/context/AuthContext';
import {
  AVAILABILITY_OPTIONS,
  SUGGESTED_ROLES,
  SUGGESTED_TECH,
  WORK_TYPE_OPTIONS,
  type WorkSettings,
} from '@/components/onboarding/PreferencesStep';
import { MinMatchPercentField } from '@/components/onboarding/MinMatchPercentField';
import { MonthYearField } from '@/components/onboarding/MonthYearField';
import { DegreeCombobox } from '@/components/onboarding/DegreeCombobox';
import type { DegreeLevel } from '@/lib/degreeNormalization';
import type { PortfolioItem } from '@/types';
import type { SettingsFormState } from '@/lib/settingsProfileForm';
import { readableDisplayName } from '@/lib/readableDisplayName';
import {
  formatEducationYearRange,
  formatWorkDateRange,
} from '@/lib/profileDisplayFormat';

export const EXPERIENCE_OPTIONS = [
  { value: '0-2', label: '0–2 years' },
  { value: '3-5', label: '3–5 years' },
  { value: '6-10', label: '6–10 years' },
  { value: '10+', label: '10+ years' },
] as const;

export function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      <div className="onboarding-section__heading">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
      </div>
      {description && (
        <p className="onboarding-pref-hint onboarding-pref-hint--tight">{description}</p>
      )}
    </div>
  );
}

function SnapshotChip({ children }: { children: string }) {
  return <span className="settings-snapshot-chip">{children}</span>;
}

function SnapshotField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  const display = value.trim() || '—';
  return (
    <div className={`settings-snapshot-field${fullWidth ? ' settings-snapshot-field--full' : ''}`}>
      <dt className="settings-snapshot-field__label">{label}</dt>
      <dd className="settings-snapshot-field__value" title={display.length > 48 ? display : undefined}>
        {display}
      </dd>
    </div>
  );
}

export function SettingsSavedSnapshot({
  form,
  onViewCv,
}: {
  form: SettingsFormState;
  onViewCv?: () => void;
}) {
  const workRows = form.workExperience.filter(w => w.jobTitle.trim() || w.companyName.trim());
  const eduRows = form.education.filter(
    e => e.schoolName.trim() || e.degree.trim() || (e.degreeTitle ?? '').trim(),
  );
  const projectRows = form.portfolioItems.filter(p => p.title.trim());
  const workSettingLabel = [
    form.workSettings.remote && 'Remote',
    form.workSettings.onsite && 'On-site',
    form.workSettings.hybrid && 'Hybrid',
  ]
    .filter(Boolean)
    .join(', ');

  const name = readableDisplayName(form.name) || form.name.trim() || 'Your profile';
  const headline = readableDisplayName(form.goalTitle);
  const location = readableDisplayName(form.location);
  const goalLocation = readableDisplayName(form.goalLocation);
  const experienceLabel =
    EXPERIENCE_OPTIONS.find(o => o.value === form.experienceYears)?.label ?? form.experienceYears;

  return (
    <section className="glass-panel settings-snapshot-panel rounded p-gutter" aria-label="Saved profile summary">
      <SectionHeader
        icon="fact_check"
        title="Your saved profile"
        description="A quick read-only view of what we use for matching and AI skills."
      />

      <div className="settings-snapshot-hero">
        <p className="settings-snapshot-hero__name">{name}</p>
        {headline ? (
          <p className="settings-snapshot-hero__headline">{headline}</p>
        ) : (
          <p className="settings-snapshot-hero__headline settings-snapshot-hero__headline--muted">
            Add a professional headline below
          </p>
        )}
        <div className="settings-snapshot-hero__meta">
          {location ? (
            <span className="settings-snapshot-meta-item">
              <span className="material-symbols-outlined" aria-hidden="true">location_on</span>
              {location}
            </span>
          ) : null}
          {experienceLabel ? (
            <span className="settings-snapshot-meta-item">
              <span className="material-symbols-outlined" aria-hidden="true">work_history</span>
              {experienceLabel}
            </span>
          ) : null}
          {form.activeCvFileName && onViewCv ? (
            <button
              type="button"
              className="settings-snapshot-cv-link"
              onClick={onViewCv}
            >
              <span className="material-symbols-outlined" aria-hidden="true">description</span>
              View current CV
            </button>
          ) : form.activeCvFileName ? (
            <span className="settings-snapshot-meta-item">
              <span className="material-symbols-outlined" aria-hidden="true">description</span>
              CV uploaded
            </span>
          ) : null}
        </div>
      </div>

      <div className="settings-snapshot-sections">
        <section className="settings-snapshot-section">
          <h3 className="settings-snapshot-section__title">Job preferences</h3>
          <dl className="settings-snapshot-grid">
            <SnapshotField label="Preferred location" value={goalLocation} />
            <SnapshotField label="Work setting" value={workSettingLabel} />
            <SnapshotField label="Availability" value={form.availability} />
            <SnapshotField
              label="Salary"
              value={`${form.salaryCurrency} ${form.salaryMinK}k – ${form.salaryMaxK}k`}
            />
            <SnapshotField
              label="Minimum match"
              value={`${form.minMatchPercent}%`}
            />
            <SnapshotField
              label="Visa sponsorship"
              value={form.sponsorship ? 'Required' : 'Not required'}
            />
          </dl>
          {form.selectedRoles.length > 0 && (
            <div className="settings-snapshot-chip-group">
              <p className="settings-snapshot-chip-group__label">Target roles</p>
              <div className="settings-snapshot-chip-row">
                {form.selectedRoles.map(role => (
                  <SnapshotChip key={role}>{role}</SnapshotChip>
                ))}
              </div>
            </div>
          )}
          {form.selectedTech.length > 0 && (
            <div className="settings-snapshot-chip-group">
              <p className="settings-snapshot-chip-group__label">Tech stack</p>
              <div className="settings-snapshot-chip-row">
                {form.selectedTech.map(tech => (
                  <SnapshotChip key={tech}>{tech}</SnapshotChip>
                ))}
              </div>
            </div>
          )}
          {form.workTypes.length > 0 && (
            <div className="settings-snapshot-chip-group">
              <p className="settings-snapshot-chip-group__label">Work types</p>
              <div className="settings-snapshot-chip-row">
                {form.workTypes.map(type => (
                  <SnapshotChip key={type}>{type}</SnapshotChip>
                ))}
              </div>
            </div>
          )}
        </section>

        {(workRows.length > 0 || eduRows.length > 0 || projectRows.length > 0) && (
          <section className="settings-snapshot-section">
            <h3 className="settings-snapshot-section__title">Background</h3>
            {workRows.length > 0 && (
              <ul className="settings-snapshot-list">
                {workRows.map((w, i) => {
                  const dateRange = formatWorkDateRange(w.startDate, w.endDate, w.current);
                  const meta = [dateRange, w.location?.trim()].filter(Boolean).join(' · ');
                  return (
                    <li key={`${w.jobTitle}-${w.companyName}-${i}`}>
                      <span className="settings-snapshot-list__title">{w.jobTitle || 'Role'}</span>
                      <span className="settings-snapshot-list__sub">
                        {w.companyName || 'Company'}
                      </span>
                      {meta ? (
                        <span className="settings-snapshot-list__meta">{meta}</span>
                      ) : null}
                      {w.description.trim() ? (
                        <p className="settings-snapshot-list__body">{w.description.trim()}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {eduRows.length > 0 && (
              <ul className="settings-snapshot-list settings-snapshot-list--spaced">
                {eduRows.map((e, i) => {
                  const degreeLabel = e.degreeTitle?.trim() || e.degree.trim() || 'Degree';
                  const yearRange = formatEducationYearRange(
                    e.startYear,
                    e.endYear,
                    e.graduationYear,
                  );
                  const meta = [e.fieldOfStudy.trim(), yearRange, e.location?.trim()]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li key={`${e.schoolName}-${i}`}>
                      <span className="settings-snapshot-list__title">{degreeLabel}</span>
                      <span className="settings-snapshot-list__sub">{e.schoolName}</span>
                      {meta ? (
                        <span className="settings-snapshot-list__meta">{meta}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {projectRows.length > 0 && (
              <ul className="settings-snapshot-list settings-snapshot-list--spaced">
                {projectRows.map(item => {
                  const meta = [item.location?.trim(), item.url?.trim()]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li key={item.id}>
                      <span className="settings-snapshot-list__title">{item.title}</span>
                      {meta ? (
                        <span className="settings-snapshot-list__meta">{meta}</span>
                      ) : null}
                      {item.description?.trim() ? (
                        <p className="settings-snapshot-list__body">{item.description.trim()}</p>
                      ) : null}
                      {(item.techTags ?? []).length > 0 ? (
                        <div className="settings-snapshot-chip-row settings-snapshot-chip-row--tight">
                          {(item.techTags ?? []).map(tag => (
                            <SnapshotChip key={tag}>{tag}</SnapshotChip>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

function ChipToggle({
  label,
  selected,
  tone = 'default',
  onToggle,
}: {
  label: string;
  selected: boolean;
  tone?: 'default' | 'gap';
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`onboarding-chip${selected ? ' onboarding-chip--selected' : ''}${tone === 'gap' ? ' onboarding-chip--gap' : ''}`}
    >
      {label}
      <span className="material-symbols-outlined" aria-hidden="true">
        {selected ? 'check' : 'add'}
      </span>
    </button>
  );
}

export function WorkEntryCard({
  entry,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  entry: OnboardingWorkEntry;
  index: number;
  onChange: (index: number, patch: Partial<OnboardingWorkEntry>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const id = (field: string) => `settings-work-${index}-${field}`;
  return (
    <div className="onboarding-panel">
      {canRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            onClick={onRemove}
            className="onboarding-panel__delete"
            aria-label={`Remove role ${index + 1}`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      )}
      <div className="onboarding-grid-2">
        <div>
          <label className="settings-label" htmlFor={id('jobTitle')}>Job title</label>
          <input
            id={id('jobTitle')}
            className="settings-input"
            value={entry.jobTitle}
            onChange={e => onChange(index, { jobTitle: e.target.value })}
            placeholder="Software Engineer"
          />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('company')}>Company</label>
          <input
            id={id('company')}
            className="settings-input"
            value={entry.companyName}
            onChange={e => onChange(index, { companyName: e.target.value })}
            placeholder="Acme Corp"
          />
        </div>
      </div>
      <div className="onboarding-grid-2" style={{ marginTop: '1.5rem' }}>
        <MonthYearField
          label="Start date"
          idPrefix={id('start')}
          value={entry.startDate}
          onChange={v => onChange(index, { startDate: v })}
        />
        <MonthYearField
          label="End date"
          idPrefix={id('end')}
          value={entry.endDate}
          disabled={entry.current}
          onChange={v => onChange(index, { endDate: v })}
          {...(entry.current ? { hint: 'Leave blank while you still work here' } : {})}
        />
      </div>
      <div className="onboarding-field onboarding-field--muted" style={{ marginTop: '1rem' }}>
        <label className="settings-label" htmlFor={id('location')}>Location</label>
        <input
          id={id('location')}
          className="settings-input"
          value={entry.location ?? ''}
          onChange={e => onChange(index, { location: e.target.value })}
          placeholder="Dublin, Ireland or Remote"
        />
      </div>
      <div className="onboarding-checkbox-row" style={{ marginTop: '1rem' }}>
        <input
          id={id('current')}
          type="checkbox"
          checked={entry.current}
          onChange={e =>
            onChange(index, {
              current: e.target.checked,
              endDate: e.target.checked ? '' : entry.endDate,
            })
          }
        />
        <label htmlFor={id('current')}>I currently work here</label>
      </div>
      <div className="onboarding-field onboarding-field--muted">
        <label htmlFor={id('desc')}>Description</label>
        <textarea
          id={id('desc')}
          rows={3}
          className="onboarding-input-sm"
          style={{ resize: 'none' }}
          value={entry.description}
          onChange={e => onChange(index, { description: e.target.value })}
          placeholder="Describe your responsibilities and achievements..."
        />
      </div>
    </div>
  );
}

export function EducationEntryCard({
  entry,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  entry: OnboardingEducationEntry;
  index: number;
  onChange: (index: number, patch: Partial<OnboardingEducationEntry>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const id = (field: string) => `settings-edu-${index}-${field}`;
  return (
    <div className="onboarding-panel">
      {canRemove && (
        <div className="onboarding-panel__delete-row">
          <button
            type="button"
            onClick={onRemove}
            className="onboarding-panel__delete"
            aria-label={`Remove education ${index + 1}`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
          </button>
        </div>
      )}
      <div className="onboarding-grid-2">
        <div className="sm:col-span-2">
          <label className="settings-label" htmlFor={id('school')}>School / university</label>
          <input
            id={id('school')}
            className="settings-input"
            value={entry.schoolName}
            onChange={e => onChange(index, { schoolName: e.target.value })}
          />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('degree')}>Degree</label>
          <DegreeCombobox
            id={id('degree')}
            className="settings-input"
            degreeLevel={(entry.degreeLevel as DegreeLevel | '') ?? ''}
            degreeTitle={entry.degreeTitle ?? entry.degree}
            onChange={patch => {
              const next: Partial<OnboardingEducationEntry> = {
                degreeTitle: patch.degreeTitle,
                degree: patch.degreeTitle || entry.degree,
              };
              if (patch.degreeLevel) next.degreeLevel = patch.degreeLevel;
              onChange(index, next);
            }}
          />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('field')}>Field of study</label>
          <input
            id={id('field')}
            className="settings-input"
            value={entry.fieldOfStudy}
            onChange={e => onChange(index, { fieldOfStudy: e.target.value })}
          />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('startYear')}>Start year</label>
          <input
            id={id('startYear')}
            type="number"
            min={1950}
            max={2100}
            className="settings-input"
            value={entry.startYear}
            onChange={e => onChange(index, { startYear: e.target.value })}
            placeholder="2016"
          />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('endYear')}>End year</label>
          <input
            id={id('endYear')}
            type="number"
            min={1950}
            max={2100}
            className="settings-input"
            value={entry.endYear}
            onChange={e =>
              onChange(index, {
                endYear: e.target.value,
                graduationYear: e.target.value,
              })
            }
            placeholder="2020"
          />
        </div>
        <div>
          <label className="settings-label" htmlFor={id('location')}>Location</label>
          <input
            id={id('location')}
            className="settings-input"
            value={entry.location ?? ''}
            onChange={e => onChange(index, { location: e.target.value })}
            placeholder="City or country"
          />
        </div>
      </div>
    </div>
  );
}

export function SettingsPreferencesSection({
  form,
  patch,
}: {
  form: SettingsFormState;
  patch: (p: Partial<SettingsFormState>) => void;
}) {
  const [customRole, setCustomRole] = useState('');
  const [customTech, setCustomTech] = useState('');
  const roleInputId = useId();
  const techInputId = useId();
  const toggleList = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  const salaryLabel = useMemo(() => {
    const sym = form.salaryCurrency === 'USD' ? '$' : form.salaryCurrency === 'GBP' ? '£' : '€';
    return `${sym}${form.salaryMinK}k – ${sym}${form.salaryMaxK}k`;
  }, [form.salaryCurrency, form.salaryMinK, form.salaryMaxK]);
  const patchWorkSettings = (patchWs: Partial<WorkSettings>) =>
    patch({ workSettings: { ...form.workSettings, ...patchWs } });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="onboarding-pref-section__label">Desired roles</h3>
        <div className="onboarding-chip-row">
          {SUGGESTED_ROLES.map(role => (
            <ChipToggle
              key={role}
              label={role}
              selected={form.selectedRoles.includes(role)}
              onToggle={() => patch({ selectedRoles: toggleList(form.selectedRoles, role) })}
            />
          ))}
          {form.selectedRoles
            .filter(r => !SUGGESTED_ROLES.includes(r as (typeof SUGGESTED_ROLES)[number]))
            .map(role => (
              <ChipToggle
                key={role}
                label={role}
                selected
                onToggle={() => patch({ selectedRoles: form.selectedRoles.filter(r => r !== role) })}
              />
            ))}
        </div>
        <div className="onboarding-chip-add-row">
          <input
            id={roleInputId}
            className="onboarding-chip-custom__input flex-1 min-w-0"
            value={customRole}
            onChange={e => setCustomRole(e.target.value)}
            placeholder="Add custom role…"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const v = customRole.trim();
                if (v && !form.selectedRoles.some(r => r.toLowerCase() === v.toLowerCase())) {
                  patch({ selectedRoles: [...form.selectedRoles, v] });
                  setCustomRole('');
                }
              }
            }}
          />
          <button
            type="button"
            className="onboarding-chip-custom__add"
            aria-label="Add custom role"
            onClick={() => {
              const v = customRole.trim();
              if (!v) return;
              if (!form.selectedRoles.some(r => r.toLowerCase() === v.toLowerCase())) {
                patch({ selectedRoles: [...form.selectedRoles, v] });
              }
              setCustomRole('');
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
        </div>
      </div>
      <div>
        <h3 className="onboarding-pref-section__label">Core tech stack</h3>
        <div className="onboarding-chip-row">
          {SUGGESTED_TECH.map(tech => (
            <ChipToggle
              key={tech}
              label={tech}
              selected={form.selectedTech.includes(tech)}
              tone="gap"
              onToggle={() => patch({ selectedTech: toggleList(form.selectedTech, tech) })}
            />
          ))}
          {form.selectedTech
            .filter(t => !SUGGESTED_TECH.includes(t as (typeof SUGGESTED_TECH)[number]))
            .map(tech => (
              <ChipToggle
                key={tech}
                label={tech}
                selected
                tone="gap"
                onToggle={() => patch({ selectedTech: form.selectedTech.filter(x => x !== tech) })}
              />
            ))}
        </div>
        <div className="onboarding-chip-add-row">
          <input
            id={techInputId}
            className="onboarding-chip-custom__input flex-1 min-w-0"
            value={customTech}
            onChange={e => setCustomTech(e.target.value)}
            placeholder="Add technology…"
          />
          <button
            type="button"
            className="onboarding-chip-custom__add"
            aria-label="Add technology"
            onClick={() => {
              const v = customTech.trim();
              if (!v) return;
              if (!form.selectedTech.some(t => t.toLowerCase() === v.toLowerCase())) {
                patch({ selectedTech: [...form.selectedTech, v] });
              }
              setCustomTech('');
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="onboarding-pref-section__label">Work type</h3>
          <div className="onboarding-chip-row">
            {WORK_TYPE_OPTIONS.map(type => (
              <ChipToggle
                key={type}
                label={type}
                selected={form.workTypes.includes(type)}
                onToggle={() => patch({ workTypes: toggleList(form.workTypes, type) })}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="onboarding-pref-section__label">Work setting</h3>
          <div className="onboarding-chip-row">
            <ChipToggle
              label="Remote"
              selected={form.workSettings.remote}
              onToggle={() => patchWorkSettings({ remote: !form.workSettings.remote })}
            />
            <ChipToggle
              label="On-site"
              selected={form.workSettings.onsite}
              onToggle={() => patchWorkSettings({ onsite: !form.workSettings.onsite })}
            />
            <ChipToggle
              label="Hybrid"
              selected={form.workSettings.hybrid}
              onToggle={() => patchWorkSettings({ hybrid: !form.workSettings.hybrid })}
            />
          </div>
        </div>
      </div>
      <MinMatchPercentField
        id="settings-min-match"
        value={form.minMatchPercent}
        onChange={minMatchPercent => patch({ minMatchPercent })}
      />
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="settings-label mb-0">Salary expectations (annual)</p>
          <span className="font-body-md text-body-md text-primary font-medium">{salaryLabel}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="settings-label" htmlFor="settings-salary-min">Minimum (k)</label>
            <input
              id="settings-salary-min"
              type="number"
              min={20}
              max={500}
              className="settings-input"
              value={form.salaryMinK}
              onChange={e =>
                patch({ salaryMinK: Math.min(Number(e.target.value) || 0, form.salaryMaxK) })
              }
            />
          </div>
          <div>
            <label className="settings-label" htmlFor="settings-salary-max">Maximum (k)</label>
            <input
              id="settings-salary-max"
              type="number"
              min={20}
              max={500}
              className="settings-input"
              value={form.salaryMaxK}
              onChange={e =>
                patch({ salaryMaxK: Math.max(Number(e.target.value) || 0, form.salaryMinK) })
              }
            />
          </div>
          <div>
            <label className="settings-label" htmlFor="settings-currency">Currency</label>
            <select
              id="settings-currency"
              className="settings-input"
              value={form.salaryCurrency}
              onChange={e => patch({ salaryCurrency: e.target.value })}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="settings-label" htmlFor="settings-availability">Availability</label>
          <select
            id="settings-availability"
            className="settings-input"
            value={form.availability}
            onChange={e => patch({ availability: e.target.value })}
          >
            {AVAILABILITY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer pt-6 sm:pt-8">
          <input
            type="checkbox"
            checked={form.sponsorship}
            onChange={e => patch({ sponsorship: e.target.checked })}
            className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
          />
          <span className="font-body-md text-body-md text-on-surface">I require visa sponsorship</span>
        </label>
      </div>
    </div>
  );
}

type PortfolioDraft = {
  title: string;
  url: string;
  description: string;
  location: string;
  techTags: string;
};

const emptyPortfolioDraft = (): PortfolioDraft => ({
  title: '',
  url: '',
  description: '',
  location: '',
  techTags: '',
});

export function PortfolioSettingsSection({
  items,
  busy,
  onAdd,
  onUpdate,
  onRemove,
}: {
  items: PortfolioItem[];
  busy?: boolean;
  onAdd: (draft: PortfolioDraft) => Promise<void>;
  onUpdate: (itemId: string, draft: PortfolioDraft) => Promise<void>;
  onRemove: (itemId: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<PortfolioDraft>(emptyPortfolioDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PortfolioDraft>(emptyPortfolioDraft);

  const startEdit = (item: PortfolioItem) => {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      url: item.url ?? '',
      description: item.description ?? '',
      location: item.location ?? '',
      techTags: (item.techTags ?? []).join(', '),
    });
    setAdding(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(emptyPortfolioDraft());
  };

  const submitAdd = async () => {
    if (!draft.title.trim()) return;
    await onAdd(draft);
    setDraft(emptyPortfolioDraft());
    setAdding(false);
  };

  const submitEdit = async () => {
    if (!editingId || !editDraft.title.trim()) return;
    await onUpdate(editingId, editDraft);
    cancelEdit();
  };

  const renderDraftFields = (
    value: PortfolioDraft,
    onChange: (next: PortfolioDraft) => void,
    idPrefix: string,
  ) => (
    <div className="space-y-3">
      <input
        className="settings-input"
        placeholder="Project title *"
        value={value.title}
        onChange={e => onChange({ ...value, title: e.target.value })}
        id={`${idPrefix}-title`}
      />
      <input
        className="settings-input"
        placeholder="URL (optional)"
        value={value.url}
        onChange={e => onChange({ ...value, url: e.target.value })}
        id={`${idPrefix}-url`}
      />
      <input
        className="settings-input"
        placeholder="Location (optional)"
        value={value.location}
        onChange={e => onChange({ ...value, location: e.target.value })}
        id={`${idPrefix}-location`}
      />
      <input
        className="settings-input"
        placeholder="Tech stack (comma-separated)"
        value={value.techTags}
        onChange={e => onChange({ ...value, techTags: e.target.value })}
        id={`${idPrefix}-tech`}
      />
      <textarea
        className="settings-input resize-none"
        rows={3}
        placeholder="Description (optional)"
        value={value.description}
        onChange={e => onChange({ ...value, description: e.target.value })}
        id={`${idPrefix}-desc`}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="settings-portfolio-item">
          {editingId === item.id ? (
            <>
              {renderDraftFields(editDraft, setEditDraft, `edit-${item.id}`)}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  className="settings-btn-primary"
                  disabled={busy}
                  onClick={() => void submitEdit()}
                >
                  Save project
                </button>
                <button type="button" className="settings-btn-outline" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body-md text-body-md font-medium text-on-surface">{item.title}</p>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate block"
                  >
                    {item.url}
                  </a>
                ) : null}
                {item.location ? (
                  <p className="text-sm text-on-surface-variant mt-0.5">{item.location}</p>
                ) : null}
                {item.description ? (
                  <p className="text-sm text-on-surface-variant mt-1 whitespace-pre-wrap">
                    {item.description}
                  </p>
                ) : null}
                {(item.techTags ?? []).length > 0 ? (
                  <div className="settings-snapshot-chip-row settings-snapshot-chip-row--tight">
                    {(item.techTags ?? []).map(tag => (
                      <SnapshotChip key={tag}>{tag}</SnapshotChip>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  className="settings-btn-outline"
                  onClick={() => startEdit(item)}
                  aria-label={`Edit ${item.title}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="settings-btn-outline"
                  disabled={busy}
                  onClick={() => void onRemove(item.id)}
                  aria-label={`Remove ${item.title}`}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="settings-portfolio-item">
          {renderDraftFields(draft, setDraft, 'new-portfolio')}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="settings-btn-primary"
              disabled={busy}
              onClick={() => void submitAdd()}
            >
              Add project
            </button>
            <button
              type="button"
              className="settings-btn-outline"
              onClick={() => {
                setAdding(false);
                setDraft(emptyPortfolioDraft());
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="onboarding-btn-text-add"
          onClick={() => {
            setAdding(true);
            cancelEdit();
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          Add project
        </button>
      )}
    </div>
  );
}
