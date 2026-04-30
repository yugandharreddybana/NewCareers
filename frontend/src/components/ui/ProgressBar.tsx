import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'gradient';
  showLabel?: boolean;
  label?: string;
  className?: string;
  animated?: boolean;
}

const sizeMap = { xs: 'h-1', sm: 'h-1.5', md: 'h-2' };
const variantMap = {
  brand:    'bg-brand',
  success:  'bg-success-500',
  warning:  'bg-warning-500',
  danger:   'bg-danger-500',
  gradient: 'bg-gradient-to-r from-brand to-brand-400',
};

export function ProgressBar({
  value, max = 100, size = 'sm', variant = 'brand',
  showLabel, label, className, animated = false,
}: ProgressBarProps) {
  const pct = Math.round((value / max) * 100);
  const color = variant === 'gradient' ? 'brand' :
    pct >= 80 ? 'success' : pct >= 50 ? 'brand' : pct >= 30 ? 'warning' : 'danger';
  const auto = variant === 'gradient' ? 'gradient' : color as typeof variant;

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showLabel && <span className="text-xs font-semibold text-text-primary">{pct}%</span>}
        </div>
      )}
      <div className={cn('w-full bg-ink-100 rounded-full overflow-hidden', sizeMap[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-spring',
            variantMap[auto],
            animated && 'animate-pulse-soft'
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
