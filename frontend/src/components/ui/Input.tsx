import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:            string;
  error?:            string;
  hint?:             string;
  leftIcon?:         ReactNode;
  rightIcon?:        ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, wrapperClassName, className, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-text-primary">
            {label}
            {props.required && <span className="text-danger-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-text-tertiary pointer-events-none flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={cn(
              'w-full h-10 px-3.5 rounded-lg border bg-white text-sm text-text-primary',
              'placeholder:text-text-tertiary outline-none transition-all duration-150',
              'focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-raised',
              error ? 'border-danger-500 focus:ring-danger-500/20 focus:border-danger-500' : 'border-border',
              leftIcon  && 'pl-10',
              rightIcon && 'pr-10',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-text-tertiary flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {(error || hint) && (
          <p className={cn('text-xs', error ? 'text-danger-500' : 'text-text-tertiary')}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
export default Input;
