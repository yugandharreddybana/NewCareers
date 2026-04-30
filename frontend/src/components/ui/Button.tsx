import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // base
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg ' +
  'transition-all duration-150 select-none whitespace-nowrap ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:    'bg-brand text-white shadow-sm hover:bg-brand-700 hover:shadow-glow-sm',
        secondary:  'bg-white border border-border text-text-secondary shadow-xs hover:border-border-strong hover:text-text-primary hover:bg-ink-50',
        ghost:      'text-text-secondary hover:bg-ink-100 hover:text-text-primary',
        danger:     'bg-danger text-white shadow-xs hover:bg-danger-600',
        'brand-soft': 'bg-brand-100 text-brand-700 hover:bg-brand-200',
        link:       'text-brand underline-offset-4 hover:underline p-0 h-auto',
        outline:    'border border-brand text-brand hover:bg-brand-50',
      },
      size: {
        xs:  'text-xs px-2.5 h-7 rounded-md',
        sm:  'text-xs px-3 h-8',
        md:  'text-sm px-4 h-9',
        lg:  'text-sm px-5 h-11',
        xl:  'text-base px-6 h-12',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
        'icon-lg': 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
