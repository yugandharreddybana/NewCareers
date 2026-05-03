// LoadingSpinner — branded CareerOps loader used app-wide
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function LoadingSpinner({ size = 'md', fullPage = false }: {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}) {
  const dim   = size === 'sm' ? 32 : size === 'lg' ? 64 : 48;
  const icon  = size === 'sm' ? 12 : size === 'lg' ? 24 : 18;

  const spinner = (
    <div className="flex flex-col items-center gap-4">
      {/* Rotating ring + icon */}
      <div className="relative" style={{ width: dim, height: dim }}>
        {/* Outer spinning ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: 'transparent', borderTopColor: '#6366f1', borderRightColor: '#818cf8' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner pulsing brand icon */}
        <motion.div
          className="absolute inset-[6px] bg-brand-500 rounded-lg flex items-center justify-center shadow-sm"
          animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles size={icon} className="text-white" />
        </motion.div>
      </div>

      {size !== 'sm' && (
        <motion.p
          className="text-xs font-medium text-text-tertiary tracking-wide"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          Loading…
        </motion.p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc]">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Full-page variant used by App.tsx Suspense boundary
export function PageLoader() {
  return <LoadingSpinner size="md" fullPage />;
}
