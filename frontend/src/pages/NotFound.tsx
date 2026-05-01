import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, SearchX } from 'lucide-react';

/**
 * 404 Not Found page.
 * Rendered by the catch-all route in App.tsx:
 *   <Route path="*" element={<NotFound />} />
 */
export default function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-surface
                        border border-border flex items-center justify-center
                        shadow-sm">
          <SearchX className="w-7 h-7 text-text-tertiary" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold font-display text-text-primary mb-2">
          404
        </h1>
        <p className="text-lg font-medium text-text-primary mb-1">
          Page not found
        </p>
        <p className="text-sm text-text-muted mb-2">
          <code className="text-xs bg-surface-offset px-1.5 py-0.5 rounded font-mono">
            {location.pathname}
          </code>
          {' '}doesn’t exist.
        </p>
        <p className="text-sm text-text-muted mb-8">
          It may have been moved, deleted, or you may have mistyped the URL.
        </p>

        {/* CTA */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-brand-500 text-white text-sm font-semibold
                     hover:bg-brand-600 active:bg-brand-700
                     transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
