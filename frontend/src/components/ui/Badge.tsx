import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold border transition-colors',
  {
    variants: {
      variant: {
        default:  'bg-ink-50 text-ink-600 border-ink-200',
        brand:    'bg-brand-50 text-brand-700 border-brand-200',
        success:  'bg-success-50 text-success-text border-success-border',
        warning:  'bg-warning-50 text-warning-text border-warning-border',
        danger:   'bg-danger-50 text-danger-text border-danger-border',
        info:     'bg-info-50 text-info-text border-info-border',
        outline:  'bg-transparent text-text-secondary border-border',
      },
      size: {
        sm: 'text-2xs px-1.5 py-px rounded',
        md: 'text-xs px-2 py-0.5 rounded-md',
        lg: 'text-xs px-2.5 py-1 rounded-md',
      },
      dot: {
        true: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  icon?: React.ReactNode;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size, dot }), className)}
      {...props}
    >
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full shrink-0',
          variant === 'success' ? 'bg-success-600' :
          variant === 'warning' ? 'bg-warning-600' :
          variant === 'danger'  ? 'bg-danger-600'  :
          variant === 'brand'   ? 'bg-brand'        :
          'bg-ink-400'
        )} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export default Badge;
