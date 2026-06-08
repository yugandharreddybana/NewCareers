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
import type { SettingsFormState } from '@/lib/settingsProfileForm';

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

export function SettingsSavedSnapshot({ form }: { form: SettingsFormState }) {
  const workRows = form.workExperience.filter(w => w.jobTitle.trim() || w.companyName.trim());
  const eduRows = form.education.filter(e => e.schoolName.trim());
  const workSettingLabel = [
    form.workSettings.remote && 'Remote',
    form.workSettings.onsite && 'On-site',
    form.workSettings.hybrid && 'Hybrid',
  ]
    .filter(Boolean)
    .join(', ');

  const items: { label: string; value: string }[] = [
    { label: 'Name', value: form.name || '—' },
    { label: 'Headline', value: form.goalTitle || '—' },
    { label: 'Location', value: form.location || '—' },
    { label: 'Preferred job location', value: form.goalLocation || '—' },
    { label: 'Experience', value: form.experienceYears || '—' },
    {
      label: 'Target roles',
      value: form.selectedRoles.length ? form.selectedRoles.join(', ') : '—',
    },
    {
      label: 'Tech stack',
      value: form.selectedTech.length ? form.selectedTech.join(', ') : '—',
    },
    { label: 'Work types', value: form.workTypes.join(', ') || '—' },
    { label: 'Work setting', value: workSettingLabel || '—' },
    {
      label: 'Salary',
      value: `${form.salaryCurrency} ${form.salaryMinK}k – ${form.salaryMaxK}k`,
    },
    { label: 'Availability', value: form.availability || '—' },
    { label: 'Visa sponsorship', value: form.sponsorship ? 'Required' : 'Not required' },
    { label: 'Minimum match to show jobs', value: `${form.minMatchPercent}%` },
    { label: 'CV on file', value: form.activeCvFileName ?? 'None uploaded' },
    {
      label: 'Work history',
      value: workRows.length
        ? workRows.map(w => `${w.jobTitle} @ ${w.companyName}`.trim()).join(' · ')
        : '—',
    },
    {
      label: 'Education',
      value: eduRows.length
        ? eduRows.map(e => `${e.degree} — ${e.schoolName}`.trim()).join(' · ')
        : '—',
    },
  ];

  return (
    <section className="glass-panel rounded p-gutter" aria-label="Saved profile summary">
      <SectionHeader
        icon="fact_check"
        title="Your saved profile"
        description="Everything currently stored for job matching and AI skills."
      />
      <dl className="settings-snapshot-grid">
        {items.map(row => (
          <div key={row.label} className="settings-snapshot-row">
            <dt className="settings-label mb-0">{row.label}</dt>
            <dd className="font-body-sm text-on-surface mt-1 break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
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
          <label className="settings-label" htmlFor={id('year')}>Graduation year</label>
          <input
            id={id('year')}
            className="settings-input"
            value={entry.graduationYear}
            onChange={e => onChange(index, { graduationYear: e.target.value })}
            placeholder="2024"
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
