type MinMatchPercentFieldProps = {
  value: number;
  onChange: (value: number) => void;
  id?: string;
};

export function MinMatchPercentField({ value, onChange, id = 'min-match-percent' }: MinMatchPercentFieldProps) {
  return (
    <section className="onboarding-pref-section">
      <label className="onboarding-pref-section__label" htmlFor={id}>
        Minimum match score to show jobs
      </label>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Only roles at or above this AI match percentage appear in your tracker and new deliveries.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 min-w-[12rem] accent-primary"
        />
        <span className="font-headline-sm text-headline-sm text-primary tabular-nums w-14 text-right">
          {value}%
        </span>
      </div>
    </section>
  );
}
