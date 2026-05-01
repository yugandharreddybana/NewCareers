/**
 * Task 141 — EmptyState
 * Reusable empty-state component used across all pages/lists.
 * Usage:
 *   <EmptyState
 *     icon={<Building2 size={28} className="text-slate-300" />}
 *     message="No jobs found"
 *     description="Scan the market to find jobs matching your profile."
 *     cta="Scan Now"
 *     onCta={() => getMore()}
 *   />
 */
import { ReactNode } from 'react';

type Props = {
  /** Icon element — typically a lucide icon */
  icon?: ReactNode;
  /** Primary bold message */
  message: string;
  /** Optional softer sub-text */
  description?: string;
  /** CTA button label */
  cta?: string;
  /** CTA click handler */
  onCta?: () => void;
  /** Whether the CTA button is in a loading/disabled state */
  ctaLoading?: boolean;
  /** Optional second action (e.g. "or do X") */
  secondaryCta?: string;
  onSecondaryCta?: () => void;
};

export default function EmptyState({
  icon,
  message,
  description,
  cta,
  onCta,
  ctaLoading = false,
  secondaryCta,
  onSecondaryCta,
}: Props) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-14
                 flex flex-col items-center text-center"
    >
      {icon && (
        <div
          className="w-16 h-16 bg-slate-50 rounded-full flex items-center
                     justify-center mb-5"
        >
          {icon}
        </div>
      )}

      <h3 className="text-lg font-bold text-slate-800 mb-1">{message}</h3>

      {description && (
        <p className="text-sm text-slate-400 mb-6 max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {cta && onCta && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onCta}
            disabled={ctaLoading}
            className="px-7 py-3 bg-slate-900 text-white rounded-xl font-bold
                       text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {ctaLoading ? 'Loading…' : cta}
          </button>

          {secondaryCta && onSecondaryCta && (
            <button
              onClick={onSecondaryCta}
              className="px-5 py-3 text-sm font-semibold text-slate-500
                         hover:text-slate-800 transition-colors"
            >
              {secondaryCta}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
