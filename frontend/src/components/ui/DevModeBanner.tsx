/**
 * DevModeBanner — visible orange bar fixed to the bottom of the screen.
 * Only renders when VITE_DEV_BYPASS_GUARDS=true (set in .env.development).
 * Completely absent from production builds.
 */
const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_GUARDS === 'true';
const IS_DEVELOPMENT = import.meta.env.MODE === 'development';

export default function DevModeBanner() {
  if (!IS_DEVELOPMENT || !DEV_BYPASS) return null;

  return (
    <div
      role="status"
      aria-label="Developer mode active"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-xs font-bold text-center py-1.5 flex items-center justify-center gap-2 select-none"
    >
      <span className="opacity-80">⚡</span>
      <span>DEV MODE — Route guards bypassed</span>
      <span className="opacity-50">·</span>
      <span className="opacity-70 font-normal">
        Set <code className="font-mono bg-amber-600 px-1 rounded">VITE_DEV_BYPASS_GUARDS=false</code> in{' '}
        <code className="font-mono bg-amber-600 px-1 rounded">.env.development</code> to test real auth flow
      </span>
    </div>
  );
}

DevModeBanner.displayName = 'DevModeBanner';
