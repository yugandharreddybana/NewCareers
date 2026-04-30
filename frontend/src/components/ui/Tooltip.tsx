import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  asChild?: boolean;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium',
            'bg-ink-900 text-white shadow-lg',
            'animate-fade-in',
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export default Tooltip;
