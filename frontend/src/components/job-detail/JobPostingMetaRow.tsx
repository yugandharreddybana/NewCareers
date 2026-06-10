type MetaCell = {
  icon: string;
  label: string;
  value: string;
};

type Props = {
  salary?: string;
  location?: string;
  workModel?: string;
  sector?: string;
};

function MetaColumn({ icon, label, value }: MetaCell) {
  if (!value?.trim()) return <div className="job-posting-meta-row__cell job-posting-meta-row__cell--empty" />;
  return (
    <div className="job-posting-meta-row__cell">
      <span className="material-symbols-outlined job-posting-meta-row__icon" aria-hidden>
        {icon}
      </span>
      <div className="job-posting-meta-row__text">
        <span className="job-posting-meta-row__label">{label}</span>
        <span className="job-posting-meta-row__value">{value}</span>
      </div>
    </div>
  );
}

export function JobPostingMetaRow({ salary, location, workModel, sector }: Props) {
  const hasMeta = Boolean(salary?.trim() || location?.trim() || workModel?.trim());
  if (!hasMeta && !sector?.trim()) return null;

  return (
    <div className="job-posting-meta-row" aria-label="Key job details">
      {hasMeta && (
        <div className="job-posting-meta-row__grid">
          <MetaColumn icon="payments" label="Salary" value={salary ?? ''} />
          <MetaColumn icon="location_on" label="Location" value={location ?? ''} />
          <MetaColumn icon="home_work" label="Work model" value={workModel ?? ''} />
        </div>
      )}
      {sector?.trim() && (
        <p className="job-posting-meta-row__sector">
          <span className="material-symbols-outlined job-posting-meta-row__sector-icon" aria-hidden>
            domain
          </span>
          <span className="job-posting-meta-row__sector-label">Sector</span>
          <span className="job-posting-meta-row__sector-value">{sector}</span>
        </p>
      )}
    </div>
  );
}
