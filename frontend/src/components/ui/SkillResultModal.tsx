import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional data-testid for e2e */
  testId?: string;
};

/**
 * Full-screen modal shell for AI skill results (same layering as job evaluation).
 */
export function SkillResultModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testId = 'skill-result-modal',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="skill-result-modal fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-result-modal-title"
      data-testid={testId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[10001] flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant px-5 py-4 shrink-0">
          <div className="min-w-0">
            <p className="font-label-sm text-label-sm text-primary uppercase tracking-wide">AI Skill</p>
            <h2 id="skill-result-modal-title" className="font-headline-sm text-headline-sm text-on-surface truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="font-body-sm text-body-sm text-secondary mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-secondary hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="shrink-0 border-t border-outline-variant px-5 py-4 flex flex-wrap gap-3 justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
