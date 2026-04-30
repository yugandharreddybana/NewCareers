import * as RadixAvatar from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

const sizeMap = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
};

export default function Avatar({ src, name, size = 'md', className, online }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div className="relative inline-flex">
      <RadixAvatar.Root
        className={cn(
          'rounded-full overflow-hidden border border-border flex-shrink-0 flex items-center justify-center',
          sizeMap[size],
          className,
        )}
      >
        <RadixAvatar.Image src={src} alt={name} className="w-full h-full object-cover" />
        <RadixAvatar.Fallback
          className="w-full h-full flex items-center justify-center font-bold bg-brand-50 text-brand"
        >
          {initials}
        </RadixAvatar.Fallback>
      </RadixAvatar.Root>
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success-500 border-2 border-surface" />
      )}
    </div>
  );
}
