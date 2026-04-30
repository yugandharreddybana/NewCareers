import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const SIZE_MAP = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-xl',
  '2xl':'max-w-2xl',
  full: 'max-w-3xl',
};

export interface ModalProps {
  open:         boolean;
  onClose:      () => void;
  title?:       string;
  description?: string;
  size?:        keyof typeof SIZE_MAP;
  children:     React.ReactNode;
  footer?:      React.ReactNode;
  hideClose?:   boolean;
  className?:   string;
}

export default function Modal({
  open, onClose, title, description, size = 'md',
  children, footer, hideClose, className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={  { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
            className={cn(
              'relative w-full bg-white rounded-2xl shadow-2xl z-10 overflow-hidden',
              SIZE_MAP[size],
              className
            )}
            role="dialog"
            aria-modal
            aria-labelledby={title ? 'modal-title' : undefined}
          >
            {/* Header */}
            {(title || !hideClose) && (
              <div className="flex items-start justify-between px-6 pt-6">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 id="modal-title" className="text-lg font-semibold text-text-primary truncate">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-text-muted">{description}</p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    onClick={onClose}
                    className="ml-3 mt-0.5 w-8 h-8 shrink-0 flex items-center justify-center rounded-lg
                               text-text-muted hover:bg-slate-100 hover:text-text-primary transition-all"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            {/* Body */}
            <div className="px-6 py-6">{children}</div>
            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 pb-5 border-t border-border pt-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
