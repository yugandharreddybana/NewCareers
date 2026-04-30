import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function EmptyState({
  icon, title, description, action, className, size = 'md',
}: EmptyStateProps) {
  const sizeMap = {
    sm: { wrap: 'py-8', icon: 'w-10 h-10', title: 'text-sm', desc: 'text-xs' },
    md: { wrap: 'py-12', icon: 'w-14 h-14', title: 'text-base', desc: 'text-sm' },
    lg: { wrap: 'py-20', icon: 'w-20 h-20', title: 'text-lg', desc: 'text-base' },
  };
  const s = sizeMap[size];

  return (
    <div className={cn('flex flex-col items-center justify-center text-center gap-3', s.wrap, className)}>
      {icon && (
        <div className={cn(
          s.icon,
          'flex items-center justify-center rounded-2xl bg-surface-3 text-text-muted',
        )}>
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-xs">
        <p className={cn(s.title, 'font-semibold text-text-primary')}>{title}</p>
        {description && <p className={cn(s.desc, 'text-text-muted')}>{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
