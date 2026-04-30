import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:     string;
  error?:     string;
  hint?:      string;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  required?:  boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted flex">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-10 px-3 rounded-lg border bg-white text-text-primary',
              'placeholder:text-text-muted text-base transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand',
              'hover:border-border-strong',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-bg-subtle',
              error
                ? 'border-danger focus:ring-danger/20 focus:border-danger'
                : 'border-border',
              leftIcon  && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted flex">
              {rightIcon}
            </span>
          )}
        </div>
        {error  && <p className="text-xs text-danger font-medium flex items-center gap-1">⚠ {error}</p>}
        {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
