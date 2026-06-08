import { useState, type ReactNode } from 'react';

type Props = {
  id: string;
  icon: string;
  title: string;
  countLabel: string;
  defaultExpanded?: boolean;
  children: ReactNode;
};

export function CollapsibleOnboardingSection({
  id,
  icon,
  title,
  countLabel,
  defaultExpanded = true,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = `${id}-panel`;

  return (
    <section className="onboarding-collapsible">
      <button
        type="button"
        className="onboarding-collapsible__header"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="onboarding-collapsible__leading">
          <span className="material-symbols-outlined" aria-hidden="true">
            {icon}
          </span>
          <h2>{title}</h2>
          <span className="onboarding-collapsible__count">{countLabel}</span>
        </span>
        <span
          className={`material-symbols-outlined onboarding-collapsible__chevron${expanded ? ' onboarding-collapsible__chevron--open' : ''}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      {expanded && (
        <div id={panelId} className="onboarding-collapsible__body">
          {children}
        </div>
      )}
    </section>
  );
}
