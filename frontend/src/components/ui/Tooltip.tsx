import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const POSITION: Record<string, string> = {
  top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left:   'right-full top-1/2 -translate-y-1/2 mr-2',
  right:  'left-full top-1/2 -translate-y-1/2 ml-2',
};

export interface TooltipProps {
  content:   React.ReactNode;
  children:  React.ReactNode;
  side?:     'top' | 'bottom' | 'left' | 'right';
  className?: string;
  disabled?: boolean;
}

export function Tooltip({ content, children, side = 'top', className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  if (disabled) return <>{children}</>;
  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={  { opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute z-50 px-2.5 py-1.5 rounded-lg',
              'bg-slate-900 text-white text-xs font-medium whitespace-nowrap',
              'pointer-events-none shadow-lg',
              POSITION[side],
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Tooltip;
