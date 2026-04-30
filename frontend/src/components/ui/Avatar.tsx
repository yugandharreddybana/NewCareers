import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  xs: 'w-6  h-6  text-xs',
  sm: 'w-8  h-8  text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

// Deterministic pleasant colour from name
const PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100   text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100  text-amber-700',
  'bg-rose-100   text-rose-700',
  'bg-cyan-100   text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-indigo-100 text-indigo-700',
];

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColor(name?: string): string {
  if (!name) return PALETTE[0];
  const sum = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}

export interface AvatarProps {
  name?:      string;
  src?:       string;
  size?:      keyof typeof SIZE_CLASSES;
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Avatar'}
        className={cn('rounded-full object-cover shrink-0', SIZE_CLASSES[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shrink-0 select-none',
        SIZE_CLASSES[size],
        getColor(name),
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}

export default Avatar;
