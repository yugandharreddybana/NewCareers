import { cn } from '@/lib/utils';
import Button from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-8 px-4' : 'py-16 px-6',
      className
    )}>
      {icon && (
        <div className={cn(
          'flex items-center justify-center rounded-2xl bg-ink-50 text-text-tertiary mb-4',
          compact ? 'w-12 h-12' : 'w-16 h-16'
        )}>
          {icon}
        </div>
      )}
      <h3 className={cn(
        'font-semibold text-text-primary',
        compact ? 'text-sm' : 'text-base'
      )}>
        {title}
      </h3>
      {description && (
        <p className={cn(
          'text-text-secondary mt-1 max-w-xs text-balance',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          size={compact ? 'sm' : 'md'}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
