import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline' | 'purple' | 'teal' | 'orange' | 'rose';
type Size    = 'sm' | 'md' | 'lg';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:  Variant;
  size?:     Size;
  dot?:      boolean;
  icon?:     ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  default:  'bg-slate-100      text-slate-600      border-slate-200',
  primary:  'bg-brand-50       text-brand-600      border-brand-200',
  success:  'bg-success-50     text-success-700    border-success-100',
  warning:  'bg-warning-50     text-warning-600    border-warning-100',
  danger:   'bg-danger-50      text-danger-600     border-danger-100',
  outline:  'bg-transparent    text-text-secondary border-border',
  purple:   'bg-purple-50      text-purple-600     border-purple-100',
  teal:     'bg-teal-50        text-teal-600       border-teal-100',
  orange:   'bg-orange-50      text-orange-600     border-orange-100',
  rose:     'bg-rose-50        text-rose-600       border-rose-100',
};

const dots: Record<Variant, string> = {
  default: 'bg-slate-400',  primary: 'bg-brand-500',
  success: 'bg-success-500',warning: 'bg-warning-500',
  danger:  'bg-danger-500', outline: 'bg-slate-400',
  purple:  'bg-purple-500', teal:    'bg-teal-500',
  orange:  'bg-orange-500', rose:    'bg-rose-500',
};

const sizes: Record<Size, string> = {
  sm: 'text-[10px] px-1.5 py-px   gap-1',
  md: 'text-xs     px-2.5 py-0.5  gap-1.5',
  lg: 'text-xs     px-3   py-1    gap-1.5',
};

export function Badge({ variant = 'default', size = 'md', dot, icon, children, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border font-medium rounded-full',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {dot  && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dots[variant])} />}
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
