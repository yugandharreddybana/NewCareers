type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
};

const SIZE_CLASS: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'w-24 h-24',
  md: 'w-36 h-36',
  lg: 'w-48 h-48',
};

function LoaderCore({ size = 'lg' }: { size?: NonNullable<LoadingSpinnerProps['size']> }) {
  return (
    <>
      <style>{`
        @keyframes nc-rotate-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes nc-rotate-ccw {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes nc-pulse-soft {
          0%, 100% { opacity: 1; transform: scale(1); filter: blur(0px); }
          50% { opacity: 0.7; transform: scale(0.95); filter: blur(1px); }
        }
        .nc-loader-rotate-1 { animation: nc-rotate-cw 3s linear infinite; }
        .nc-loader-rotate-2 { animation: nc-rotate-ccw 2s linear infinite; }
        .nc-loader-rotate-3 { animation: nc-rotate-cw 1.5s linear infinite; }
        .nc-loader-pulse { animation: nc-pulse-soft 2s ease-in-out infinite; }
      `}</style>
      <div className={`relative ${SIZE_CLASS[size]} flex items-center justify-center`}>
        <div className="absolute w-full h-full rounded-full border border-outline-variant/30 nc-loader-rotate-1">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
        </div>
        <div className="absolute w-3/4 h-3/4 rounded-full border border-primary/20 nc-loader-rotate-2">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-secondary rounded-full" />
        </div>
        <div className="absolute w-1/2 h-1/2 rounded-full border border-primary/40 nc-loader-rotate-3">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-primary-container rounded-full" />
        </div>
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute w-full h-full bg-primary/10 rounded-full nc-loader-pulse" />
          <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_15px_rgba(0,88,190,0.5)]" />
        </div>
      </div>
    </>
  );
}

export function LoadingSpinner({ size = 'md', fullPage = false }: LoadingSpinnerProps = {}) {
  if (fullPage) {
    return (
      <div className="bg-background min-h-screen w-full flex items-center justify-center">
        <LoaderCore size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full flex items-center justify-center py-8" role="status" aria-live="polite">
      <LoaderCore size={size} />
    </div>
  );
}

export function PageLoader() {
  return <LoadingSpinner fullPage />;
}

type LoadingOverlayProps = {
  active: boolean;
  message?: string;
};

export function LoadingOverlay({ active, message = 'Processing your request...' }: LoadingOverlayProps) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[6px] z-[9999] flex items-center justify-center pointer-events-auto">
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-3xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center space-y-4">
        <LoadingSpinner size="md" />
        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest animate-pulse">
          Please Wait
        </p>
        <p className="text-sm text-slate-600 font-semibold leading-relaxed px-4">
          {message}
        </p>
      </div>
    </div>
  );
}

