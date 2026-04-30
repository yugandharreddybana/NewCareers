import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-semibold rounded-full',
  {
    variants: {
      variant: {
        default:  'bg-slate-100 text-slate-600',
        brand:    'bg-brand-light text-brand-700 border border-brand-200',
        success:  'bg-success-light text-success-text border border-success-border',
        warning:  'bg-warning-light text-warning-text border border-warning-border',
        danger:   'bg-danger-light text-danger-text border border-danger-border',
        info:     'bg-info-light text-info-text border border-info-border',
        outline:  'border border-border text-text-secondary bg-white',
        solid:    'bg-brand text-white',
      },
      size: {
        sm: 'px-2    py-px  text-xs',
        md: 'px-2.5  py-0.5 text-xs',
        lg: 'px-3    py-1   text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const DOT_COLORS: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  brand:   'bg-brand',
  info:    'bg-info',
};

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            DOT_COLORS[variant ?? 'default'] ?? 'bg-slate-400'
          )}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
