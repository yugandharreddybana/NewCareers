import type { ReactNode } from 'react';

export function AccountSettingsPageHeader({
  title,
  subtitle,
  banner,
}: {
  title: string;
  subtitle: string;
  banner?: ReactNode;
}) {
  return (
    <header className="mb-stack-lg">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm">{title}</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
      {banner}
    </header>
  );
}
