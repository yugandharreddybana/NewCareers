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
            aria-label={`Add ${customPlaceholder.replace(/\.\.\.$/, '')}`}
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
  if (max < min + SALARY_GAP_K) {
    max = Math.min(SALARY_CEILING_K, min + SALARY_GAP_K);
  }
  if (min > max - SALARY_GAP_K) {
    min = Math.max(SALARY_FLOOR_K, max - SALARY_GAP_K);
  }
  return { minK: min, maxK: max };
}

function salarySymbol(currency: string): string {
  if (currency === 'USD') return '$';
  if (currency === 'GBP') return '£';
  return '€';
}

function SalaryRangeSlider({
  minK,
  maxK,
  currency,
  onChange,
}: {
  minK: number;
  maxK: number;
  currency: string;
  onChange: (minK: number, maxK: number) => void;
}) {
  const sym = salarySymbol(currency);
  const span = SALARY_CEILING_K - SALARY_FLOOR_K;
  const leftPct = span > 0 ? ((minK - SALARY_FLOOR_K) / span) * 100 : 0;
  const rightPct = span > 0 ? 100 - ((maxK - SALARY_FLOOR_K) / span) * 100 : 0;

  const apply = (nextMin: number, nextMax: number) => {
    const clamped = clampSalaryRange(nextMin, nextMax);
    onChange(clamped.minK, clamped.maxK);
  };

  const setMin = (v: number) => {
    apply(v, maxK);
  };

  const setMax = (v: number) => {
    apply(minK, v);
  };

  const onManualMin = (raw: string) => {
    const parsed = raw === '' ? SALARY_FLOOR_K : Number(raw);
    if (Number.isNaN(parsed)) return;
    setMin(parsed);
  };

  const onManualMax = (raw: string) => {
    const parsed = raw === '' ? SALARY_FLOOR_K : Number(raw);
    if (Number.isNaN(parsed)) return;
    setMax(parsed);
  };

  return (
    <div className="onboarding-salary-controls">
      <div className="onboarding-salary-manual">
        <label className="onboarding-salary-manual__field">
          <span className="onboarding-salary-manual__label">Min ({sym}k)</span>
          <input
            type="number"
            className="onboarding-salary-manual__input"
            min={SALARY_FLOOR_K}
            max={SALARY_CEILING_K}
            step={1}
            value={minK}
            aria-label="Minimum salary in thousands"
            onChange={e => onManualMin(e.target.value)}
          />
        </label>
        <label className="onboarding-salary-manual__field">
          <span className="onboarding-salary-manual__label">Max ({sym}k)</span>
          <input
            type="number"
            className="onboarding-salary-manual__input"
            min={SALARY_FLOOR_K}
            max={SALARY_CEILING_K}
            step={1}
            value={maxK}
            aria-label="Maximum salary in thousands"
            onChange={e => onManualMax(e.target.value)}
          />
        </label>
      </div>
      <div className="onboarding-salary-slider">
        <div className="onboarding-salary-slider__track-wrap">
          <div className="onboarding-salary-slider__track-bg" />
          <div
            className="onboarding-salary-slider__track-fill"
            style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
          />
          <input
            type="range"
            className="onboarding-salary-slider__input"
            min={SALARY_FLOOR_K}
            max={SALARY_CEILING_K}
            value={minK}
            aria-label="Minimum salary slider"
            onChange={e => setMin(Number(e.target.value))}
          />
          <input
            type="range"
            className="onboarding-salary-slider__input"
            min={SALARY_FLOOR_K}
            max={SALARY_CEILING_K}
            value={maxK}
            aria-label="Maximum salary slider"
            onChange={e => setMax(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

function WorkSettingCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="onboarding-setting-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        className="onboarding-setting-check__input"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="onboarding-setting-check__box" aria-hidden="true">
        <span className="material-symbols-outlined">check</span>
      </span>
      <span>{label}</span>
    </label>
  );
}

export function PreferencesStep({ values, saving, onChange, onBack, onComplete }: PreferencesStepProps) {
  const cvRef = useRef<HTMLInputElement>(null);
  const [customRole, setCustomRole] = useState('');
  const [customTech, setCustomTech] = useState('');

  const toggleList = useCallback((list: string[], value: string) => {
    return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
  }, []);

  const salaryLabel = useMemo(() => {
    const sym = salarySymbol(values.salaryCurrency);
    return `${sym}${values.salaryMinK}k — ${sym}${values.salaryMaxK}k`;
  }, [values.salaryCurrency, values.salaryMinK, values.salaryMaxK]);

  const hasWorkSetting =
    values.workSettings.remote || values.workSettings.onsite || values.workSettings.hybrid;
  const canComplete =
    values.cvFile !== null &&
    values.selectedRoles.length > 0 &&
    values.workTypes.length > 0 &&
    hasWorkSetting;

  const addCustomRole = () => {
    const v = customRole.trim();
    if (!v) return;
    const exists = values.selectedRoles.some(r => r.toLowerCase() === v.toLowerCase());
    if (exists) {
      setCustomRole('');
      return;
    }
    onChange({ selectedRoles: [...values.selectedRoles, v] });
    setCustomRole('');
  };

  const addCustomTech = () => {
    const v = customTech.trim();
    if (!v) return;
    const exists = values.selectedTech.some(t => t.toLowerCase() === v.toLowerCase());
    if (exists) {
      setCustomTech('');
      return;
    }
    onChange({ selectedTech: [...values.selectedTech, v] });
    setCustomTech('');
  };

  return (
    <>
      <div className="onboarding-card__title onboarding-card__title--preferences">
        <h1>What are you looking for?</h1>
        <p>Help us match you with the right opportunities by telling us your preferences.</p>
      </div>

      <form
        className="onboarding-form onboarding-form--preferences"
        onSubmit={e => {
          e.preventDefault();
          if (!canComplete) {
            toast.error('Upload your CV, select at least one role, and complete work preferences.');
            return;
          }
          onComplete();
        }}
      >
        <p className="onboarding-pref-hint">
          Fields marked with <span className="onboarding-required">*</span> are required.
        </p>

        <ChipSection
          title="Desired Roles"
          required
          options={SUGGESTED_ROLES}
          selected={values.selectedRoles}
          onToggle={role => onChange({ selectedRoles: toggleList(values.selectedRoles, role) })}
          customValue={customRole}
          onCustomChange={setCustomRole}
          onAddCustom={addCustomRole}
          customPlaceholder="Add custom role..."
        />

        <ChipSection
          title="Core Tech Stack"
          options={SUGGESTED_TECH}
          chipTone="gap"
          selected={values.selectedTech}
          onToggle={tech => onChange({ selectedTech: toggleList(values.selectedTech, tech) })}
          customValue={customTech}
          onCustomChange={setCustomTech}
          onAddCustom={addCustomTech}
          customPlaceholder="Add technology..."
        />

        <div className="onboarding-pref-grid-2">
          <section className="onboarding-pref-section">
            <SectionLabel required>Work Type</SectionLabel>
            <div className="onboarding-chip-row">
              {WORK_TYPE_OPTIONS.map(type => (
                <ToggleChip
                  key={type}
                  label={type}
                  selected={values.workTypes.includes(type)}
                  onToggle={() => onChange({ workTypes: toggleList(values.workTypes, type) })}
                />
              ))}
            </div>
          </section>

          <section className="onboarding-pref-section">
            <SectionLabel required>Work Setting</SectionLabel>
            <div className="onboarding-setting-row">
              <WorkSettingCheckbox
                label="Remote"
                checked={values.workSettings.remote}
                onChange={remote =>
                  onChange({ workSettings: { ...values.workSettings, remote } })
                }
              />
              <WorkSettingCheckbox
                label="On-site"
                checked={values.workSettings.onsite}
                onChange={onsite =>
                  onChange({ workSettings: { ...values.workSettings, onsite } })
                }
              />
              <WorkSettingCheckbox
                label="Hybrid"
                checked={values.workSettings.hybrid}
                onChange={hybrid =>
                  onChange({ workSettings: { ...values.workSettings, hybrid } })
                }
              />
            </div>
          </section>
        </div>

        <section className="onboarding-pref-section">
          <div className="onboarding-salary-header">
            <SectionLabel required>Salary Expectations (Annual)</SectionLabel>
            <div className="onboarding-salary-header__value">
              <span className="onboarding-salary-header__range">{salaryLabel}</span>
              <select
                className="onboarding-salary-currency"
                value={values.salaryCurrency}
                onChange={e => onChange({ salaryCurrency: e.target.value })}
                aria-label="Salary currency"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <SalaryRangeSlider
            minK={values.salaryMinK}
            maxK={values.salaryMaxK}
            currency={values.salaryCurrency}
            onChange={(salaryMinK, salaryMaxK) => onChange({ salaryMinK, salaryMaxK })}
          />
        </section>

        <section className="onboarding-pref-section">
          <SectionLabel required>Availability</SectionLabel>
          <div className="onboarding-field__relative">
            <select
              className="onboarding-select onboarding-select--pref"
              value={values.availability}
              onChange={e => onChange({ availability: e.target.value })}
            >
              {AVAILABILITY_OPTIONS.map(opt => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined onboarding-field__icon onboarding-field__icon--right">
              keyboard_arrow_down
            </span>
          </div>
        </section>

        <MinMatchPercentField
          value={values.minMatchPercent}
          onChange={minMatchPercent => onChange({ minMatchPercent })}
        />

        <section className="onboarding-pref-section">
          <SectionLabel required>Upload CV</SectionLabel>
          <p className="onboarding-pref-hint onboarding-pref-hint--tight">
            Required — we use your CV for AI matching. Select at least one target role above.
          </p>
          <input
            ref={cvRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            aria-label="Upload your CV"
            onChange={e => onChange({ cvFile: e.target.files?.[0] ?? null })}
          />
          <button
            type="button"
            className="onboarding-cv-dropzone"
            onClick={() => cvRef.current?.click()}
          >
            <span className="material-symbols-outlined onboarding-cv-dropzone__icon">cloud_upload</span>
            <div className="onboarding-cv-dropzone__text">
              {values.cvFile ? (
                <>
                  <p className="onboarding-cv-dropzone__title">{values.cvFile.name}</p>
                  <p className="onboarding-cv-dropzone__sub">
                    {(values.cvFile.size / 1024 / 1024).toFixed(2)} MB — click to replace
                  </p>
                </>
              ) : (
                <>
                  <p className="onboarding-cv-dropzone__title">Upload your CV</p>
                  <p className="onboarding-cv-dropzone__sub">PDF, DOCX up to 5MB</p>
                </>
              )}
            </div>
            <span className="onboarding-cv-dropzone__btn">Choose File</span>
          </button>
        </section>

        <label className="onboarding-sponsorship">
          <input
            type="checkbox"
            checked={values.sponsorship}
            onChange={e => onChange({ sponsorship: e.target.checked })}
          />
          <span>
            <strong>Requires visa sponsorship</strong>
            <span className="onboarding-sponsorship__hint">
              Check if you need a Critical Skills permit in Ireland
            </span>
          </span>
        </label>

        <div className="onboarding-actions onboarding-actions--preferences">
          <button
            className="onboarding-btn-primary onboarding-btn-primary--complete"
            type="submit"
            disabled={saving || !canComplete}
          >
            Complete Profile
            <span className="material-symbols-outlined onboarding-icon-filled" aria-hidden="true">
              rocket_launch
            </span>
          </button>
          <button className="onboarding-btn-outline" type="button" onClick={onBack} disabled={saving}>
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
            Back
          </button>
        </div>
      </form>

      <p className="onboarding-privacy-note">
        Your data is secure and will only be shared with verified recruiters who match your criteria.
      </p>
    </>
  );
}
