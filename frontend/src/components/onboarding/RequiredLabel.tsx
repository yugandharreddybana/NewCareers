import type { ReactNode } from 'react';

export function RequiredMark() {
  return (
    <span className="onboarding-required" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

export function FieldLabel({
  htmlFor,
  required,
  children,
  className = '',
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={className}>
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}

export function SectionLabel({
  required,
  children,
  className = 'onboarding-pref-section__label',
}: {
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={className}>
      {children}
      {required ? <RequiredMark /> : null}
    </h2>
  );
}
