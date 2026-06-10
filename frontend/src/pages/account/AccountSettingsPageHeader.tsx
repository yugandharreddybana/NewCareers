import type { ReactNode } from 'react';

export function AccountSettingsPageHeader({
  title,
  subtitle,
  banner,
  actions,
  actionsClassName,
  className,
}: {
  title: string;
  subtitle: string;
  banner?: ReactNode;
  actions?: ReactNode;
  actionsClassName?: string;
  className?: string;
}) {
  return (
    <header className={className ?? 'mb-stack-lg'}>
      <div className="flex flex-col gap-stack-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-stack-sm">{title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
        </div>
        {actions ? (
          <div className={actionsClassName ? `shrink-0 ${actionsClassName}` : 'shrink-0'}>
            {actions}
          </div>
        ) : null}
      </div>
      {banner}
    </header>
  );
}
