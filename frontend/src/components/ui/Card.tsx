import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'elevated' | 'bordered' | 'flat' | 'ghost';
type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?:     Variant;
  padding?:     Padding;
  interactive?: boolean;
  children?:    ReactNode;
  asChild?:     boolean;
}

const variants: Record<Variant, string> = {
  default:  'bg-white border border-border shadow-card',
  elevated: 'bg-white border border-border shadow-lg',
  bordered: 'bg-white border-2 border-border',
  flat:     'bg-surface-raised border border-border',
  ghost:    'bg-transparent',
};

const paddings: Record<Padding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
  xl:   'p-8',
};

export function Card({ variant = 'default', padding = 'none', interactive, children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        variants[variant],
        paddings[padding],
        interactive && [
          'cursor-pointer transition-all duration-200',
          'hover:shadow-card-hover hover:-translate-y-0.5',
          'active:translate-y-0 active:shadow-card',
        ],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pt-6 pb-0', className)} {...props}>{children}</div>
  );
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-5', className)} {...props}>{children}</div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4 border-t border-border bg-surface-raised/60 rounded-b-xl', className)} {...props}>
      {children}
    </div>
  );
}

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';

export default Card;
