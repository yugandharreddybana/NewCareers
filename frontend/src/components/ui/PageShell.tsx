/**
 * PageShell — Section 13 QA update
 *  - Design tokens throughout (was using hard-coded slate-* classes)
 *  - Responsive header: stacks on mobile (375px), row on sm+
 *  - Accessible: h1 landmark, divider is presentational (aria-hidden)
 */
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

type Props = {
  title: string;
  subtitle?: string;
  /** Buttons/controls rendered top-right on desktop, below title on mobile */
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
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-text-tertiary mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" aria-hidden="true" />

      {/* Page content — fade-in on mount */}
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
