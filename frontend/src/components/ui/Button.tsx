import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-semibold',
    'transition-all duration-150 active:scale-[0.98]',
    'disabled:opacity-50 disabled:pointer-events-none select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:   'bg-brand text-white hover:bg-brand-hover shadow-xs hover:shadow-brand',
        secondary: 'bg-white border border-border text-text-primary shadow-xs hover:border-brand/40 hover:bg-brand-light hover:text-brand',
        ghost:     'text-text-secondary hover:bg-slate-50 hover:text-text-primary',
        danger:    'bg-danger text-white hover:bg-red-600 shadow-xs',
        outline:   'border-2 border-brand text-brand hover:bg-brand hover:text-white',
        brand:     'bg-brand-light border border-brand-200 text-brand-700 hover:bg-brand-100',
        link:      'text-brand underline-offset-4 hover:underline p-0 h-auto shadow-none',
      },
      size: {
        xs:   'h-7  px-2.5 text-xs  rounded-md',
        sm:   'h-8  px-3   text-sm  rounded-lg',
        md:   'h-9  px-4   text-base rounded-lg',
        lg:   'h-10 px-5   text-md  rounded-xl',
        xl:   'h-11 px-6   text-lg  rounded-xl',
        icon: 'h-9  w-9           rounded-lg',
        'icon-sm': 'h-8 w-8       rounded-lg',
        'icon-lg': 'h-10 w-10     rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?:   boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading
        ? <Loader2 size={14} className="animate-spin shrink-0" />
        : leftIcon
          ? <span className="shrink-0 flex">{leftIcon}</span>
          : null}
      {children}
      {!loading && rightIcon && <span className="shrink-0 flex">{rightIcon}</span>}
    </button>
  )
);

Button.displayName = 'Button';
export { buttonVariants };
export default Button;
