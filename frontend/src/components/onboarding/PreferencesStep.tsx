import { useCallback, useId, useMemo, useState } from 'react';
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

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  remote: true,
  onsite: false,
  hybrid: false,
};

/** Ensures all work-setting keys exist after partial patches or missing state. */
export function mergeWorkSettings(
  prev: WorkSettings | undefined,
  patch?: Partial<WorkSettings>,
): WorkSettings {
  return { ...DEFAULT_WORK_SETTINGS, ...prev, ...patch };
}

export function hasWorkSetting(settings: WorkSettings | undefined): boolean {
  const s = mergeWorkSettings(settings);
  return s.remote || s.onsite || s.hybrid;
}

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
  hint,
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
  hint?: string;
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
      {hint ? <p className="onboarding-pref-hint onboarding-pref-hint--tight">{hint}</p> : null}
      <div className="onboarding-chip-row onboarding-chip-row--tags">
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
      </div>
      <div className="onboarding-chip-add-row">
        <label className="sr-only" htmlFor={inputId}>
          {customPlaceholder}
        </label>
        <input
          id={inputId}
          className="onboarding-chip-custom__input flex-1 min-w-0"
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
          aria-label={`Add ${customPlaceholder.replace(/\.\.\.$/, '')}`}
          onClick={onAddCustom}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
        </button>
      </div>
    </section>
  );
}

const SALARY_FLOOR_K = 20;
const SALARY_CEILING_K = 300;
const SALARY_GAP_K = 5;

function clampSalaryRange(minK: number, maxK: number): { minK: number; maxK: number } {
  let min = Math.max(SALARY_FLOOR_K, Math.min(SALARY_CEILING_K, Math.round(minK)));
  let max = Math.max(SALARY_FLOOR_K, Math.min(SALARY_CEILING_K, Math.round(maxK)));
  if (max < min + SALARY_GAP_K) max = Math.min(SALARY_CEILING_K, min + SALARY_GAP_K);
  if (min > max - SALARY_GAP_K) min = Math.max(SALARY_FLOOR_K, max - SALARY_GAP_K);
  return { minK: min, maxK: max };
}

function salarySymbol(currency: string): string {
  if (currency === 'USD') return '$';
  if (currency === 'GBP') return '£';
  return '€';
}

function SalaryRangeField({
  minK,
  maxK,
  currency,
  onChange,
}: {
  minK: number;
  maxK: number;
  currency: string;
  onChange: (patch: { salaryMinK?: number; salaryMaxK?: number; salaryCurrency?: string }) => void;
}) {
  const sym = salarySymbol(currency);
  const label = `${sym}${minK}k – ${sym}${maxK}k`;

  const setMin = (v: number) => {
    const next = clampSalaryRange(v, maxK);
    onChange({ salaryMinK: next.minK, salaryMaxK: next.maxK });
  };
  const setMax = (v: number) => {
    const next = clampSalaryRange(minK, v);
    onChange({ salaryMinK: next.minK, salaryMaxK: next.maxK });
  };

  const minPct = ((minK - SALARY_FLOOR_K) / (SALARY_CEILING_K - SALARY_FLOOR_K)) * 100;
  const maxPct = ((maxK - SALARY_FLOOR_K) / (SALARY_CEILING_K - SALARY_FLOOR_K)) * 100;

  return (
    <section className="onboarding-pref-section">
      <div className="onboarding-salary-header">
        <SectionLabel>Salary expectations (annual)</SectionLabel>
        <div className="onboarding-salary-header__value">
          <span className="onboarding-salary-header__range">{label}</span>
          <select
            className="onboarding-salary-currency"
            value={currency}
            aria-label="Salary currency"
            onChange={e => onChange({ salaryCurrency: e.target.value })}
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
      </div>
      <div className="onboarding-salary-controls">
        <div className="onboarding-salary-slider">
          <div className="onboarding-salary-slider__track-wrap" aria-hidden="true">
            <div className="onboarding-salary-slider__track-bg" />
            <div
              className="onboarding-salary-slider__track-fill"
              style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
            />
          </div>
          <input
            type="range"
            className="onboarding-salary-slider__input"
            min={SALARY_FLOOR_K}
            max={SALARY_CEILING_K}
            step={5}
            value={minK}
            aria-label="Minimum salary in thousands"
            onChange={e => setMin(Number(e.target.value))}
          />
          <input
            type="range"
            className="onboarding-salary-slider__input"
            min={SALARY_FLOOR_K}
            max={SALARY_CEILING_K}
            step={5}
            value={maxK}
            aria-label="Maximum salary in thousands"
            onChange={e => setMax(Number(e.target.value))}
            style={{ zIndex: 3 }}
          />
        </div>
        <div className="onboarding-salary-manual">
          <div className="onboarding-salary-manual__field">
            <label className="onboarding-salary-manual__label" htmlFor="pref-salary-min">
              Minimum (k)
            </label>
            <input
              id="pref-salary-min"
              type="number"
              className="onboarding-salary-manual__input"
              min={SALARY_FLOOR_K}
              max={SALARY_CEILING_K}
              value={minK}
              onChange={e => setMin(Number(e.target.value) || SALARY_FLOOR_K)}
            />
          </div>
          <div className="onboarding-salary-manual__field">
            <label className="onboarding-salary-manual__label" htmlFor="pref-salary-max">
              Maximum (k)
            </label>
            <input
              id="pref-salary-max"
              type="number"
              className="onboarding-salary-manual__input"
              min={SALARY_FLOOR_K}
              max={SALARY_CEILING_K}
              value={maxK}
              onChange={e => setMax(Number(e.target.value) || SALARY_FLOOR_K)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

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
        ? `Posted within the last ${value} days`
        : value === 7
          ? 'Posted within the last week'
          : value === 14
            ? 'Posted within the last 2 weeks'
            : value === 30
              ? 'Posted within the last month'
              : `Posted within the last ${value} days`;

  return (
    <section className="onboarding-pref-section">
      <SectionLabel>Job freshness</SectionLabel>
      <p className="onboarding-pref-hint onboarding-pref-hint--tight">
        We only pull listings from job boards within this window.
      </p>
      <div className="onboarding-freshness">
        <input
          id={id}
          className="onboarding-freshness__range"
          type="range"
          min={1}
          max={30}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          aria-label="Maximum job age in days"
        />
        <span className="onboarding-freshness__badge" aria-hidden="true">
          {value}d
        </span>
      </div>
      <p className="onboarding-freshness__caption">{label}</p>
    </section>
  );
}

function WorkSettingField({
  settings,
  onChange,
}: {
  settings: WorkSettings | undefined;
  onChange: (next: WorkSettings) => void;
}) {
  const safe = mergeWorkSettings(settings);
  const items: { key: keyof WorkSettings; label: string }[] = [
    { key: 'remote', label: 'Remote' },
    { key: 'hybrid', label: 'Hybrid' },
    { key: 'onsite', label: 'On-site' },
  ];

  return (
    <section className="onboarding-pref-section">
      <SectionLabel>Work setting</SectionLabel>
      <div className="onboarding-chip-row">
        {items.map(({ key, label }) => (
          <ToggleChip
            key={key}
            label={label}
            selected={!!safe[key]}
            onToggle={() => onChange({ ...safe, [key]: !safe[key] })}
          />
        ))}
      </div>
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

  const handleComplete = useCallback(() => {
    if (!hasWorkSetting(values.workSettings)) {
      toast.error('Select at least one work setting (Remote, On-site, or Hybrid).');
      return;
    }
    onComplete();
  }, [values.workSettings, onComplete]);

  const canProceed = values.selectedRoles.length > 0 && values.cvFile != null;
  const summaryParts = [
    values.selectedRoles.length > 0 ? `${values.selectedRoles.length} role${values.selectedRoles.length === 1 ? '' : 's'}` : null,
    values.selectedTech.length > 0 ? `${values.selectedTech.length} skill${values.selectedTech.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <div className="onboarding-step onboarding-preferences">
      <p className="onboarding-pref-summary" aria-live="polite">
        {summaryParts.join(' · ')}
      </p>

      <div className="onboarding-pref-card">
        <h2 className="onboarding-pref-card__title">
          <span className="material-symbols-outlined" aria-hidden="true">
            work
          </span>
          What you&apos;re looking for
        </h2>
        <ChipSection
          title="Desired roles"
          required
          hint="Pick at least one — we use these to search job boards and rank matches."
          options={SUGGESTED_ROLES}
          selected={values.selectedRoles}
          onToggle={toggleRole}
          customValue={customRole}
          onCustomChange={setCustomRole}
          onAddCustom={addCustomRole}
          customPlaceholder="Add custom role..."
        />
        <ChipSection
          title="Tech stack"
          hint="Skills we look for in job descriptions (optional but improves accuracy)."
          options={SUGGESTED_TECH}
          selected={values.selectedTech}
          onToggle={toggleTech}
          customValue={customTech}
          onCustomChange={setCustomTech}
          onAddCustom={addCustomTech}
          customPlaceholder="Add technology..."
          chipTone="gap"
        />
        <SalaryRangeField
          minK={values.salaryMinK}
          maxK={values.salaryMaxK}
          currency={values.salaryCurrency}
          onChange={onChange}
        />
      </div>

      <div className="onboarding-pref-card">
        <h2 className="onboarding-pref-card__title">
          <span className="material-symbols-outlined" aria-hidden="true">
            tune
          </span>
          How you want to work
        </h2>
        <section className="onboarding-pref-section">
          <SectionLabel>Work type</SectionLabel>
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
        <WorkSettingField
          settings={values.workSettings}
          onChange={workSettings => onChange({ workSettings })}
        />
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
        <label className="onboarding-sponsorship">
          <input
            type="checkbox"
            checked={values.sponsorship}
            onChange={e => onChange({ sponsorship: e.target.checked })}
          />
          <span>
            <strong>I require visa sponsorship</strong>
            <span>We&apos;ll prioritise employers who sponsor work permits when possible.</span>
          </span>
        </label>
      </div>

      <div className="onboarding-pref-card">
        <h2 className="onboarding-pref-card__title">
          <span className="material-symbols-outlined" aria-hidden="true">
            psychology
          </span>
          Matching rules
        </h2>
        <MaxAgeDaysField value={values.maxAgeDays ?? 7} onChange={v => onChange({ maxAgeDays: v })} />
        <MinMatchPercentField
          value={values.minMatchPercent}
          onChange={v => onChange({ minMatchPercent: v })}
        />
      </div>

      <div className="onboarding-actions">
        <button type="button" className="onboarding-btn-outline" onClick={onBack} disabled={saving}>
          Back
        </button>
        <button
          type="button"
          className="onboarding-btn-primary onboarding-btn-primary--full"
          disabled={!canProceed || saving}
          onClick={handleComplete}
        >
          {saving ? 'Creating your account…' : 'Complete profile'}
          {!saving && (
            <span className="material-symbols-outlined" aria-hidden="true">
              radar
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
