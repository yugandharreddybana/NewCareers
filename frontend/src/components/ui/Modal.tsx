import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
  className?: string;
}

const sizeMap = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-4xl',
};

export default function Modal({
  open, onClose, title, description, children,
  size = 'md', showClose = true, className,
}: ModalProps) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, handleKey]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={cn(
              'relative z-10 w-full bg-white rounded-2xl shadow-2xl border border-border',
              sizeMap[size],
              className
            )}
          >
            {(title || showClose) && (
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
                <div>
                  {title && <h2 className="text-base font-semibold text-text-primary">{title}</h2>}
                  {description && <p className="text-sm text-text-secondary mt-0.5">{description}</p>}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary hover:bg-ink-100 transition-colors ml-4"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
