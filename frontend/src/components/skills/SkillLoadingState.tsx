import { LoadingSpinner } from '@/components/LoadingSpinner';

type Props = {
  label: string;
  className?: string;
};

/** Canonical in-modal loader for AI skills (matches ApiLoadingOverlay / LoadingSpinner). */
export function SkillLoadingState({ label, className = '' }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-10 ${className}`}
      role="status"
      aria-live="polite"
      data-testid="skill-loading-state"
    >
      <LoadingSpinner size="md" />
      <p className="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">
        Please wait
      </p>
      <p className="text-sm text-on-surface-variant font-medium text-center max-w-xs px-4">
        {label}
      </p>
    </div>
  );
}
