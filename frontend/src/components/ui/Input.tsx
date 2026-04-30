import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftIcon, rightIcon, inputSize = 'md', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    const heightClass = inputSize === 'sm' ? 'h-8 text-xs' : inputSize === 'lg' ? 'h-11 text-base' : 'h-10 text-sm';
    const paddingLeft = leftIcon  ? 'pl-9'   : 'pl-3.5';
    const paddingRight= rightIcon ? 'pr-9'   : 'pr-3.5';

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl border bg-surface text-text-primary placeholder:text-text-muted',
              'transition-all duration-150 outline-none',
              'focus:border-brand focus:ring-2 focus:ring-brand/15',
              'disabled:bg-surface-3 disabled:text-text-muted disabled:cursor-not-allowed',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
                : 'border-border hover:border-border-strong',
              heightClass,
              paddingLeft,
              paddingRight,
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-danger-600 font-medium">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export default Input;
