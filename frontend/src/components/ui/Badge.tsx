import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold border transition-colors',
  {
    variants: {
      variant: {
        brand:   'bg-brand-50   text-brand-700   border-brand-100',
        success: 'bg-success-50 text-success-700 border-success-100',
        warning: 'bg-warning-50 text-warning-600 border-warning-100',
        danger:  'bg-danger-50  text-danger-700  border-danger-100',
        info:    'bg-info-50    text-info-600    border-info-100',
        muted:   'bg-surface-3  text-text-secondary border-border',
        outline: 'bg-transparent text-text-secondary border-border',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0.5 rounded-full',
        md: 'text-xs px-2 py-0.5 rounded-full',
        lg: 'text-sm px-3 py-1 rounded-full',
      },
    },
    defaultVariants: { variant: 'muted', size: 'md' },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          variant === 'success' ? 'bg-success-500' :
          variant === 'warning' ? 'bg-warning-500' :
          variant === 'danger'  ? 'bg-danger-500'  :
          variant === 'brand'   ? 'bg-brand'       : 'bg-text-muted'
        )} />
      )}
      {children}
    </span>
  )
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
export default Badge;
