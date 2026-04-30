import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  'bg-white rounded-xl transition-all duration-150',
  {
    variants: {
      variant: {
        flat:     'border border-border',
        raised:   'border border-border shadow-sm',
        elevated: 'border border-border shadow-md',
        brand:    'border border-brand-200 bg-brand-light',
        ghost:    'bg-transparent',
      },
      padding: {
        none: '',
        sm:   'p-4',
        md:   'p-5',
        lg:   'p-6',
        xl:   'p-8',
      },
      hoverable: {
        true:  'cursor-pointer hover:shadow-md hover:-translate-y-px',
        false: '',
      },
    },
    defaultVariants: {
      variant:   'raised',
      padding:   'lg',
      hoverable: false,
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, padding, hoverable, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, padding, hoverable }), className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between mb-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-text-primary leading-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-text-muted mt-0.5', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-5 pt-4 border-t border-border flex items-center gap-3', className)}
      {...props}
    />
  );
}

export default Card;
