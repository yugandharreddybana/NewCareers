import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
type Size    = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  leftIcon?: ReactNode;
  rightIcon?:ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:   'bg-brand-500 text-white hover:bg-brand-600 shadow-brand hover:shadow-brand-lg border-transparent',
  secondary: 'bg-white text-text-primary border-border hover:bg-surface-raised hover:border-border-strong',
  ghost:     'bg-transparent text-text-secondary border-transparent hover:bg-surface-overlay hover:text-text-primary',
  danger:    'bg-danger-500 text-white border-transparent hover:bg-danger-600 shadow-sm',
  outline:   'bg-transparent text-brand-500 border-brand-300 hover:bg-brand-pale hover:border-brand-400',
  success:   'bg-success-500 text-white border-transparent hover:bg-success-600 shadow-sm',
};

const sizes: Record<Size, string> = {
  sm:       'h-8  px-3   text-xs  gap-1.5 rounded-md',
  md:       'h-9  px-4   text-sm  gap-2   rounded-lg',
  lg:       'h-11 px-6   text-sm  gap-2   rounded-xl',
  'icon-sm':'h-7  w-7    p-0      rounded-md',
  icon:     'h-9  w-9    p-0      rounded-lg',
  'icon-lg':'h-11 w-11   p-0      rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold border transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 focus-visible:ring-offset-1',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading
        ? <Loader2 size={14} className="animate-spin shrink-0" />
        : leftIcon ? <span className="shrink-0 flex items-center">{leftIcon}</span> : null}
      {children && !['icon','icon-sm','icon-lg'].includes(size) && <span>{children}</span>}
      {children && ['icon','icon-sm','icon-lg'].includes(size) && <span className="sr-only">{children}</span>}
      {!loading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </button>
  )
);
Button.displayName = 'Button';
export default Button;
