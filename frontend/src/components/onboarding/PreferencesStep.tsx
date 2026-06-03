import { useCallback, useId, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { SectionLabel } from '@/components/onboarding/RequiredLabel';
import { MinMatchPercentField } from '@/components/onboarding/MinMatchPercentField';

export const SUGGESTED_ROLES = [
  'Senior Product Designer',
  'UX Lead',
  'Product Manager',
  'Frontend Architect',
  'Software Engineer',
  'Full Stack Developer',
  'Backend Engineer',
  'Data Engineer',
] as const;

export const SUGGESTED_TECH = [
  'React',
  'TypeScript',
  'Node.js',
  'Python',
  'Java',
  'AWS',
  'PostgreSQL',
  'Figma',
  'Next.js',
  'Docker',
] as const;

export const WORK_TYPE_OPTIONS = ['Full-time', 'Contract', 'Freelance'] as const;

export const AVAILABILITY_OPTIONS = [
  'Immediately',
  '2 weeks notice',
  '1 month notice',
  'Flexible / Open to discussion',
] as const;

export type WorkSettings = {
  remote: boolean;
  onsite: boolean;
  hybrid: boolean;
};

export type PreferencesStepValues = {
  selectedRoles: string[];
  selectedTech: string[];
  workTypes: string[];
  workSettings: WorkSettings;
  salaryMinK: number;
  salaryMaxK: number;
  salaryCurrency: string;
  availability: string;
  cvFile: File | null;
  sponsorship: boolean;
  minMatchPercent: number;
  maxAgeDays: number;
};

type PreferencesStepProps = {
  values: PreferencesStepValues;
  saving: boolean;
  onChange: (patch: Partial<PreferencesStepValues>) => void;
  onBack: () => void;
  onComplete: () => void;
};

function ToggleChip({
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
      className={`onboarding-chip${selected ? ' onboarding-chip--selected' : ''}${tone === 'gap' ? ' onboarding-chip--gap' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
    >
      {label}
      <span className="material-symbols-outlined" aria-hidden="true">
        {selected ? 'check' : 'add'}
      </span>
    </button>
  );
}

function ChipSection({
  title,
  required,
  options,
  selected,
  onToggle,
  customValue,
  onCustomChange,
  onAddCustom,
  customPlaceholder,
  chipTone = 'default',
}: {
  title: string;
  required?: boolean;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
  onAddCustom: () => void;
  customPlaceholder: string;
  chipTone?: 'default' | 'gap';
}) {
  const inputId = useId();
  const addId = useId();
  const suggestedSet = useMemo(() => new Set<string>(options), [options]);
  const customEntries = selected.filter(item => !suggestedSet.has(item));
  const canAdd = customValue.trim().length > 0;

  return (
    <section className="onboarding-pref-section">
      {required ? <SectionLabel required>{title}</SectionLabel> : <SectionLabel>{title}</SectionLabel>}
      <div className="onboarding-chip-row">
        {options.map(option => (
          <ToggleChip
            key={option}
            label={option}
            selected={selected.includes(option)}
            tone={chipTone}
            onToggle={() => onToggle(option)}
          />
        ))}
        {customEntries.map(entry => (
          <ToggleChip
            key={`custom-${entry}`}
            label={entry}
            selected
            tone={chipTone}
            onToggle={() => onToggle(entry)}
          />
        ))}
        <div className="onboarding-chip-custom">
          <label className="sr-only" htmlFor={inputId}>
            {customPlaceholder}
          </label>
          <input
            id={inputId}
            className="onboarding-chip-custom__input"
            type="text"
            value={customValue}
            placeholder={customPlaceholder}
            onChange={e => onCustomChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddCustom();
              }
            }}
          />
          <button
            id={addId}
            type="button"
            className="onboarding-chip-custom__add"
            disabled={!canAdd}
            aria-label={`Add ${customPlaceholder.replace(/\.\.\.$/,'')}`}
            onClick={onAddCustom}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

const SALARY_FLOOR_K = 0;
const SALARY_CEILING_K = 300;
const SALARY_GAP_K = 5;

function clampSalaryRange(minK: number, maxK: number): { minK: number; maxK: number } {
  let min = Math.max(SALARY_FLOOR_K, Math.min(SALARY_CEILING_K, Math.round(minK)));
  let max = Math.max(SALARY_FLOOR_K, Math.min(SALARY_CEILING_K, Math.round(maxK)));
  if (max < min + SALARY_GAP_K) max = Math.min(SALARY_CEILING_K, min + SALARY_GAP_K);
  if (min > max - SALARY_GAP_K) min = Math.max(SALARY_FLOOR_K, max - SALARY_GAP_K);
  return { minK: min, maxK: max };
}

// ── Max Age Days slider ────────────────────────────────────────────────────────
function MaxAgeDaysField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const label =
    value === 1
      ? 'Posted today only'
      : value <= 3
      ? `Posted within last ${value} days`
      : value === 7
      ? 'Posted within last week'
      : value === 14
      ? 'Posted within last 2 weeks'
      : value === 30
      ? 'Posted within last month'
      : `Posted within last ${value} days`;

  return (
    <section className="onboarding-pref-section">
      <SectionLabel>Job Freshness</SectionLabel>
      <p className="onboarding-hint" style={{ marginBottom: '0.5rem' }}>
        Only show jobs posted within a certain number of days. Default is 7 days.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <input
          id={id}
          type="range"
          min={1}
          max={30}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
          aria-label="Maximum job age in days"
        />
        <span
          style={{
            minWidth: '2.2rem',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '1.1rem',
            color: 'var(--color-primary, #7c3aed)',
          }}
        >
          {value}d
        </span>
      </div>
      <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--color-text-muted, #888)' }}>
        {label}
      </p>
    </section>
  );
}

export function PreferencesStep({
  values,
  saving,
  onChange,
  onBack,
  onComplete,
}: PreferencesStepProps) {
  const [customRole, setCustomRole] = useState('');
  const [customTech, setCustomTech] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleRole = useCallback(
    (r: string) =>
      onChange({
        selectedRoles: values.selectedRoles.includes(r)
          ? values.selectedRoles.filter(x => x !== r)
          : [...values.selectedRoles, r],
      }),
    [values.selectedRoles, onChange],
  );

  const addCustomRole = useCallback(() => {
    const v = customRole.trim();
    if (!v) return;
    if (!values.selectedRoles.includes(v)) onChange({ selectedRoles: [...values.selectedRoles, v] });
    setCustomRole('');
  }, [customRole, values.selectedRoles, onChange]);

  const toggleTech = useCallback(
    (t: string) =>
      onChange({
        selectedTech: values.selectedTech.includes(t)
          ? values.selectedTech.filter(x => x !== t)
          : [...values.selectedTech, t],
      }),
    [values.selectedTech, onChange],
  );

  const addCustomTech = useCallback(() => {
    const v = customTech.trim();
    if (!v) return;
    if (!values.selectedTech.includes(v)) onChange({ selectedTech: [...values.selectedTech, v] });
    setCustomTech('');
  }, [customTech, values.selectedTech, onChange]);

  const toggleWorkType = useCallback(
    (t: string) =>
      onChange({
        workTypes: values.workTypes.includes(t)
          ? values.workTypes.filter(x => x !== t)
          : [...values.workTypes, t],
      }),
    [values.workTypes, onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (file && file.size > 5 * 1024 * 1024) {
        toast.error('CV must be under 5 MB');
        return;
      }
      onChange({ cvFile: file });
    },
    [onChange],
  );

  const canProceed = values.selectedRoles.length > 0;

  return (
    <div className="onboarding-step onboarding-preferences">
      <ChipSection
        title="Desired Roles"
        required
        options={SUGGESTED_ROLES}
        selected={values.selectedRoles}
        onToggle={toggleRole}
        customValue={customRole}
        onCustomChange={setCustomRole}
        onAddCustom={addCustomRole}
        customPlaceholder="Add custom role..."
      />

      <ChipSection
        title="Tech Stack"
        options={SUGGESTED_TECH}
        selected={values.selectedTech}
        onToggle={toggleTech}
        customValue={customTech}
        onCustomChange={setCustomTech}
        onAddCustom={addCustomTech}
        customPlaceholder="Add technology..."
      />

      {/* ── Job Freshness ─────────────────────────── */}
      <MaxAgeDaysField
        value={values.maxAgeDays ?? 7}
        onChange={v => onChange({ maxAgeDays: v })}
      />

      {/* ── Min Match % ──────────────────────────── */}
      <MinMatchPercentField
        value={values.minMatchPercent}
        onChange={v => onChange({ minMatchPercent: v })}
      />

      {/* ── Work Types ───────────────────────────── */}
      <section className="onboarding-pref-section">
        <SectionLabel>Work Type</SectionLabel>
        <div className="onboarding-chip-row">
          {WORK_TYPE_OPTIONS.map(t => (
            <ToggleChip
              key={t}
              label={t}
              selected={values.workTypes.includes(t)}
              onToggle={() => toggleWorkType(t)}
            />
          ))}
        </div>
      </section>

      {/* ── Work Setting ─────────────────────────── */}
      <section className="onboarding-pref-section">
        <SectionLabel>Work Setting</SectionLabel>
        <div className="onboarding-chip-row">
          {(['remote', 'onsite', 'hybrid'] as const).map(key => (
            <ToggleChip
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              selected={values.workSettings[key]}
              onToggle={() =>
                onChange({ workSettings: { ...values.workSettings, [key]: !values.workSettings[key] } })
              }
            />
          ))}
        </div>
      </section>

      {/* ── CV Upload ────────────────────────────── */}
      <section className="onboarding-pref-section">
        <SectionLabel>Upload CV / Resume</SectionLabel>
        <div className="onboarding-cv-upload">
          <button
            type="button"
            className="onboarding-btn onboarding-btn--outline"
            onClick={() => fileRef.current?.click()}
          >
            <span className="material-symbols-outlined">upload_file</span>
            {values.cvFile ? values.cvFile.name : 'Choose file (PDF / DOCX, max 5 MB)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>
      </section>

      {/* ── Visa Sponsorship ─────────────────────── */}
      <section className="onboarding-pref-section">
        <label className="onboarding-toggle-row">
          <span>I require visa sponsorship</span>
          <input
            type="checkbox"
            checked={values.sponsorship}
            onChange={e => onChange({ sponsorship: e.target.checked })}
          />
        </label>
      </section>

      {/* ── Availability ─────────────────────────── */}
      <section className="onboarding-pref-section">
        <SectionLabel>Availability</SectionLabel>
        <div className="onboarding-chip-row">
          {AVAILABILITY_OPTIONS.map(a => (
            <ToggleChip
              key={a}
              label={a}
              selected={values.availability === a}
              onToggle={() => onChange({ availability: values.availability === a ? '' : a })}
            />
          ))}
        </div>
      </section>

      {/* ── Actions ──────────────────────────────── */}
      <div className="onboarding-actions">
        <button type="button" className="onboarding-btn onboarding-btn--back" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="onboarding-btn onboarding-btn--primary"
          disabled={!canProceed || saving}
          onClick={onComplete}
        >
          {saving ? 'Saving…' : 'Find My Jobs'}
        </button>
      </div>
    </div>
  );
}
