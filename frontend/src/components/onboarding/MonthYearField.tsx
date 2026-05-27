const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

const YEAR_OPTIONS = Array.from({ length: 55 }, (_, i) => new Date().getFullYear() - i);

export function normalizeYearMonth(value?: string | null): string {
  if (!value?.trim()) return '';
  const v = value.trim();
  return /^\d{4}-\d{2}$/.test(v) ? v : '';
}

function parseYearMonth(iso: string): { year: string; month: string } {
  const normalized = normalizeYearMonth(iso);
  if (!normalized) return { year: '', month: '' };
  const [year, month] = normalized.split('-');
  return { year: year ?? '', month: month ?? '' };
}

function toYearMonth(year: string, month: string): string {
  if (!year || !month) return '';
  return `${year}-${month}`;
}

type MonthYearFieldProps = {
  label: string;
  idPrefix: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  hint?: string;
};

export function MonthYearField({
  label,
  idPrefix,
  value,
  disabled,
  onChange,
  hint,
}: MonthYearFieldProps) {
  const { year, month } = parseYearMonth(value);

  return (
    <div className="onboarding-field onboarding-field--muted">
      <span className="onboarding-field__group-label" id={`${idPrefix}-label`}>
        {label}
      </span>
      <div
        className={`onboarding-month-row${disabled ? ' onboarding-month-row--disabled' : ''}`}
        role="group"
        aria-labelledby={`${idPrefix}-label`}
      >
        <select
          id={`${idPrefix}-month`}
          className="onboarding-select-sm onboarding-select-sm--month"
          value={month}
          disabled={disabled}
          onChange={e => onChange(toYearMonth(year, e.target.value))}
          aria-label={`${label} month`}
        >
          <option value="">Month</option>
          {MONTH_OPTIONS.map(m => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          id={`${idPrefix}-year`}
          className="onboarding-select-sm onboarding-select-sm--year"
          value={year}
          disabled={disabled}
          onChange={e => onChange(toYearMonth(e.target.value, month))}
          aria-label={`${label} year`}
        >
          <option value="">Year</option>
          {YEAR_OPTIONS.map(y => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {hint && <p className="onboarding-field__hint">{hint}</p>}
    </div>
  );
}
