import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

const sizeMap = {
  xs: 'w-6 h-6 text-2xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-base',
};

export function Avatar({ name, src, size = 'md', className, online }: AvatarProps) {
  const colorIndex = (name?.charCodeAt(0) ?? 0) % 6;
  const colors = [
    'bg-brand-100 text-brand-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
    'bg-violet-100 text-violet-700',
  ];

  return (
    <div className={cn('relative shrink-0', sizeMap[size], className)}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className={cn(
          'w-full h-full rounded-full flex items-center justify-center font-semibold',
          colors[colorIndex]
        )}>
          {initials(name)}
        </div>
      )}
      {online !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white',
          online ? 'bg-success' : 'bg-ink-300'
        )} />
      )}
    </div>
  );
}

export default Avatar;
