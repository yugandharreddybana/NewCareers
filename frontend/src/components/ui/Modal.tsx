import { forwardRef, type ReactNode, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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

export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(
  { open, onClose, title, description, children, footer, size = 'md', hideCloseButton, className },
  ref,
) {
  useEffect(() => {
    if (!open) return undefined;

    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = 'hidden';

    return () => {
      style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose(); }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[3px]"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                ref={ref}
                initial={{ scale: 0.96, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl bg-white shadow-modal',
                  sizes[size],
                  className,
                )}
              >
                {(title || description || !hideCloseButton) && (
                  <div className="flex items-start justify-between px-6 pt-6 pb-4">
                    <div>
                      {title && (
                        <Dialog.Title className="text-base font-bold text-text-primary">
                          {title}
                        </Dialog.Title>
                      )}
                      {description ? (
                        <Dialog.Description className="mt-1 text-sm text-text-secondary">
                          {description}
                        </Dialog.Description>
                      ) : (
                        <Dialog.Description className="sr-only">
                          {title ? `${title} dialog` : 'Modal dialog'}
                        </Dialog.Description>
                      )}
                    </div>
                    {!hideCloseButton && (
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Close modal"
                          className="ml-4 shrink-0 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-primary"
                        >
                          <X size={16} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                )}
                <div className="px-6 pb-6">{children}</div>
                {footer && (
                  <div className="flex justify-end gap-3 border-t border-border bg-surface-raised/60 px-6 py-4">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
});

Modal.displayName = 'Modal';
export default Modal;
