import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles
  'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1',
  {
    variants: {
      variant: {
        primary:   'bg-brand text-white shadow-sm hover:bg-brand-700',
        secondary: 'bg-surface text-text-primary border border-border shadow-xs hover:bg-surface-3 hover:border-border-strong',
        ghost:     'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        danger:    'bg-danger-50 text-danger-600 border border-danger-100 hover:bg-danger-100',
        'brand-subtle': 'bg-brand-50 text-brand border border-brand-100 hover:bg-brand-100',
        link:      'text-brand underline-offset-4 hover:underline p-0 h-auto',
        outline:   'border border-brand text-brand bg-transparent hover:bg-brand-50',
      },
      size: {
        xs:   'text-xs  h-7  px-2.5 rounded-lg',
        sm:   'text-sm  h-8  px-3   rounded-lg',
        md:   'text-sm  h-9  px-4   rounded-xl',
        lg:   'text-base h-10 px-5  rounded-xl',
        xl:   'text-base h-11 px-6  rounded-xl',
        icon: 'h-9  w-9  rounded-xl',
        'icon-sm': 'h-8 w-8 rounded-lg',
        'icon-lg': 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
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
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export default Button;
