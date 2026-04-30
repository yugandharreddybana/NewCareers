import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  hideClose?: boolean;
  className?: string;
}

const sizeMap = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-2xl',
  full: 'max-w-5xl w-full mx-4',
};

export default function Modal({
  open, onClose, title, description, children, size = 'md', hideClose, className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
        />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2',
            'bg-surface rounded-2xl shadow-2xl border border-border',
            'animate-scale-in focus:outline-none',
            sizeMap[size],
            className,
          )}
          aria-describedby={description ? 'modal-desc' : undefined}
        >
          {(title || !hideClose) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              {title && (
                <Dialog.Title className="text-base font-bold text-text-primary">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description id="modal-desc" className="sr-only">{description}</Dialog.Description>
              )}
              {!hideClose && (
                <button
                  onClick={onClose}
                  className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          <div>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
