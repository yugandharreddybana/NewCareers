import { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  wrapperClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightIcon, type, wrapperClassName, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            type={inputType}
            className={cn(
              'w-full h-10 px-3.5 rounded-lg border bg-white text-sm',
              'text-text-primary placeholder:text-text-tertiary',
              'outline-none transition-all duration-150',
              'hover:border-border-strong',
              'focus:border-brand focus:ring-2 focus:ring-brand/15',
              error && 'border-danger focus:border-danger focus:ring-danger/15',
              leftIcon && 'pl-9',
              (rightIcon || isPassword) && 'pr-9',
              !error && 'border-border',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {!isPassword && rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-danger-600">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
        {!error && hint && (
          <p className="text-xs text-text-tertiary">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Textarea variant
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, wrapperClassName, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-lg border bg-white text-sm min-h-[80px] resize-y',
            'text-text-primary placeholder:text-text-tertiary',
            'outline-none transition-all duration-150',
            'hover:border-border-strong',
            'focus:border-brand focus:ring-2 focus:ring-brand/15',
            error ? 'border-danger' : 'border-border',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-600">{error}</p>}
        {!error && hint && <p className="text-xs text-text-tertiary">{hint}</p>}
      </div>
    );
  }
);
Texarea.displayName = 'Textarea';

export { Input };
export default Input;
