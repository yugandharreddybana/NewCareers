// LoadingSpinner.tsx — shared full-page and inline loading indicator
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8';
  return (
    <div className={`${dim} border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin`} />
  );
}
