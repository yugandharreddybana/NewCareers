import { cn } from '@/lib/utils';
import Button from './Button';

export interface EmptyStateProps {
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  action?: {
    label:   string;
    onClick: () => void;
    loading?: boolean;
  };
  secondaryAction?: {
    label:   string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function EmptyState({
  icon, title, description, action, secondaryAction, className, size = 'md',
}: EmptyStateProps) {
  const py = size === 'sm' ? 'py-10' : size === 'lg' ? 'py-20' : 'py-16';
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6', py, className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mb-4 text-brand">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-text-primary">{title}</p>
      {description && (
        <p className="mt-1.5 text-sm text-text-muted max-w-xs text-balance leading-relaxed">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-3">
          {action && (
            <Button size="md" onClick={action.onClick} loading={action.loading}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" size="md" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
