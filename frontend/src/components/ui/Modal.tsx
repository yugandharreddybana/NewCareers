import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open:             boolean;
  onClose:          () => void;
  title?:           string;
  description?:     string;
  children?:        ReactNode;
  footer?:          ReactNode;
  size?:            Size;
  hideCloseButton?: boolean;
  className?:       string;
}

const sizes: Record<Size, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-5xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', hideCloseButton, className }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[3px]" />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1,    opacity: 1, y: 0 }}
            exit={{   scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative w-full bg-white rounded-2xl shadow-modal overflow-hidden z-10',
              sizes[size],
              className,
            )}
          >
            {(title || !hideCloseButton) && (
              <div className="flex items-start justify-between px-6 pt-6 pb-4">
                <div>
                  {title       && <h2 className="text-base font-bold text-text-primary">{title}</h2>}
                  {description && <p  className="text-sm text-text-secondary mt-1">{description}</p>}
                </div>
                {!hideCloseButton && (
                  <button
                    onClick={onClose}
                    className="ml-4 shrink-0 p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 pb-6">{children}</div>
            {footer && (
              <div className="px-6 py-4 bg-surface-raised/60 border-t border-border flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
export default Modal;
