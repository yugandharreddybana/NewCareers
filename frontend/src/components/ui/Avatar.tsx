import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?:    string;
  src?:     string;
  size?:    Size;
  online?:  boolean;
}

const sizeMap: Record<Size, { wrap: string; text: string; dot: string }> = {
  xs: { wrap: 'w-6  h-6',  text: 'text-[10px]', dot: 'w-1.5 h-1.5 ring-1' },
  sm: { wrap: 'w-8  h-8',  text: 'text-xs',     dot: 'w-2   h-2   ring-1' },
  md: { wrap: 'w-9  h-9',  text: 'text-sm',     dot: 'w-2.5 h-2.5 ring-2' },
  lg: { wrap: 'w-11 h-11', text: 'text-base',   dot: 'w-3   h-3   ring-2' },
  xl: { wrap: 'w-14 h-14', text: 'text-lg',     dot: 'w-3.5 h-3.5 ring-2' },
};

const palette = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100   text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100  text-amber-700',
  'bg-rose-100   text-rose-700',
  'bg-cyan-100   text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-orange-100 text-orange-700',
];

function color(name?: string) {
  if (!name) return 'bg-slate-100 text-slate-500';
  return palette[name.charCodeAt(0) % palette.length];
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export function Avatar({ name, src, size = 'md', online, className, ...props }: AvatarProps) {
  const s = sizeMap[size];
  return (
    <div className={cn('relative inline-flex shrink-0', className)} {...props}>
      <div className={cn('rounded-full overflow-hidden flex items-center justify-center font-semibold select-none', s.wrap, !src && color(name))}>
        {src
          ? <img src={src} alt={name ?? 'avatar'} className="w-full h-full object-cover" />
          : <span className={s.text}>{initials(name)}</span>
        }
      </div>
      {online !== undefined && (
        <span className={cn('absolute bottom-0 right-0 rounded-full ring-white', s.dot, online ? 'bg-success-500' : 'bg-slate-300')} />
      )}
    </div>
  );
}
export default Avatar;
