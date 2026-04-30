import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cardVariants = cva(
  'rounded-xl border bg-white transition-all duration-200',
  {
    variants: {
      variant: {
        default:  'border-border shadow-card',
        raised:   'border-border shadow-lg',
        bordered: 'border-border-strong shadow-none',
        ghost:    'border-transparent bg-ink-50 shadow-none',
        brand:    'border-brand-200 bg-brand-50 shadow-none',
      },
      hoverable: {
        true: 'hover:shadow-card-hover hover:-translate-y-px cursor-pointer',
      },
      padding: {
        none: '',
        sm:   'p-4',
        md:   'p-5',
        lg:   'p-6',
        xl:   'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'none',
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hoverable, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, hoverable, padding }), className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-3 px-6 pt-6 pb-0', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold text-text-primary text-sm', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 py-5', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 pb-6 pt-0 flex items-center gap-3', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter, cardVariants };
export default Card;
