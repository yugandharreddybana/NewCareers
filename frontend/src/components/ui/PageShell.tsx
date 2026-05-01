/**
 * Task 140 — PageShell
 * Reusable page wrapper: consistent header, max-width, fade-in animation.
 * Usage:
 *   <PageShell title="Skills Coach" subtitle="Run AI tools against your jobs" actions={<button>…</button>}>
 *     {children}
 *   </PageShell>
 */
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

type Props = {
  title: string;
  subtitle?: string;
  /** Buttons/controls rendered top-right */
  actions?: ReactNode;
  children: ReactNode;
  /** Remove default top padding (e.g. when hero section handles it) */
  noPadding?: boolean;
};

export default function PageShell({
  title,
  subtitle,
  actions,
  children,
  noPadding = false,
}: Props) {
  return (
    <div className={`space-y-6 ${noPadding ? '' : 'pt-2'}`}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-200" />

      {/* Page content with fade-in */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
