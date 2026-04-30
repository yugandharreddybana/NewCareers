import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

interface EmptyStateProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  action?:      ReactNode;
  className?:   string;
  size?:        Size;
}

const sizes = {
  sm: { wrapper: 'py-10', wrap: 'w-12 h-12 text-xl mb-4',  title: 'text-sm font-semibold', desc: 'text-xs mt-1' },
  md: { wrapper: 'py-16', wrap: 'w-16 h-16 text-2xl mb-5', title: 'text-sm font-semibold', desc: 'text-sm mt-1.5' },
  lg: { wrapper: 'py-24', wrap: 'w-20 h-20 text-3xl mb-6', title: 'text-base font-semibold', desc: 'text-sm mt-2' },
};

export function EmptyState({ icon, title, description, action, className, size = 'md' }: EmptyStateProps) {
  const s = sizes[size];
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', s.wrapper, className)}>
      {icon && (
        <div className={cn('rounded-2xl bg-surface-overlay border border-border flex items-center justify-center text-text-tertiary', s.wrap)}>
          {icon}
        </div>
      )}
      <p className={cn('text-text-primary', s.title)}>{title}</p>
      {description && <p className={cn('text-text-secondary max-w-xs text-balance', s.desc)}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export default EmptyState;
