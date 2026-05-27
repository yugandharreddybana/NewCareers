import '@/styles/job-search-radar.css';



import type { OnboardingDeliveryStatus } from '@/services/api';



type Props = {
  /** e.g. "Dublin, Ireland" → location line under the main message */
  locationHint?: string;
  status?: OnboardingDeliveryStatus | null;
  failedMessage?: string | null;
  onRetry?: () => void;
  onContinue?: () => void;
};



const STAGE_LABELS: Record<string, string> = {

  reading_cv: 'Reading your CV',

  normalizing_cv: 'Preparing your profile',

  fetching_jobs: 'Searching job boards',

  evaluating_jobs: 'AI matching roles',

  ready_partial: 'Matches ready',

  ready: 'All matches loaded',

  failed: 'Matching paused',

};



function progressPercent(status: OnboardingDeliveryStatus | null | undefined): number {

  if (!status) return 12;

  if (status.readyPartial || status.ready) return 100;

  const min = Math.max(1, status.minRequired);

  const fromEval = Math.min(85, Math.round((status.evaluatedCount / min) * 85));

  const stageBoost: Record<string, number> = {

    idle: 5,

    reading_cv: 15,

    normalizing_cv: 28,

    fetching_jobs: 42,

    evaluating_jobs: 50 + fromEval / 2,

    failed: fromEval,

  };

  return Math.min(95, stageBoost[status.stage] ?? fromEval);

}



/**

 * Full-screen loader — pixel match to `HomePage` Job Search Radar Animation.

 */

export function JobSearchRadarLoader({
  locationHint,
  status,
  failedMessage,
  onRetry,
  onContinue,
}: Props) {
  const isFailed = status?.stage === 'failed' || Boolean(failedMessage);

  const locationLine = locationHint?.trim()

    ? `${locationHint.trim()} — scanning boards`

    : 'Dublin, Ireland — scanning boards';



  const headline = isFailed
    ? 'We could not finish matching'
    : status?.message?.trim() || 'AI Matching in Progress';

  const stageLabel = status?.stage ? (STAGE_LABELS[status.stage] ?? status.stage) : 'Starting';

  const subline = isFailed
    ? failedMessage ??
      status?.error ??
      'Check your connection and try again, or continue to the dashboard if some matches are already ready.'
    : status && status.evaluatedCount > 0 && status.stage === 'evaluating_jobs'
      ? `${status.evaluatedCount} of ${status.minRequired}+ roles evaluated`
      : status?.jobsDiscovered
        ? `${status.jobsDiscovered} roles discovered`
        : 'Scanning 2,500+ job boards across Europe…';



  const pct = progressPercent(status);



  return (

    <div

      className="fixed inset-0 z-[200] bg-[#f7f9fb] flex flex-col items-center justify-center min-h-screen overflow-hidden font-sans"

      role="status"

      aria-live="polite"

      aria-busy={!isFailed}

      aria-label={headline}

    >

      <div className="absolute inset-0 -z-10 opacity-30 pointer-events-none">

        <div

          className="absolute top-0 left-0 w-full h-full"

          style={{

            backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',

            backgroundSize: '24px 24px',

          }}

        />

      </div>



      <div className="relative flex flex-col items-center justify-center text-center p-8">

        <div className="relative w-80 h-80 flex items-center justify-center mb-12">

          <div className="absolute inset-0 border border-blue-100 rounded-full" />

          <div className="absolute inset-8 border border-blue-50 rounded-full opacity-60" />

          <div className="absolute inset-16 border border-blue-50 rounded-full opacity-40" />

          <div className="absolute inset-0 rounded-full radar-sweep" />

          <div className="absolute w-24 h-24 bg-blue-500 rounded-full opacity-0 radar-loader-pulse-ring" />

          <div className="absolute w-24 h-24 bg-blue-400 rounded-full opacity-0 radar-loader-pulse-ring-delay" />

          <div className="relative z-10 w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-blue-100">

            <svg

              xmlns="http://www.w3.org/2000/svg"

              width="40"

              height="40"

              viewBox="0 0 24 24"

              fill="none"

              stroke="#3b82f6"

              strokeWidth="2"

              strokeLinecap="round"

              strokeLinejoin="round"

              className="animate-pulse"

              aria-hidden

            >

              <circle cx="11" cy="11" r="8" />

              <line x1="21" y1="21" x2="16.65" y2="16.65" />

            </svg>

          </div>

          <div className="absolute top-10 left-10 search-node" style={{ animationDelay: '0.2s' }}>

            <div className="w-3 h-3 bg-blue-400 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />

          </div>

          <div className="absolute bottom-12 right-8 search-node" style={{ animationDelay: '0.8s' }}>

            <div className="w-4 h-4 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" />

          </div>

          <div className="absolute top-1/2 -right-4 search-node" style={{ animationDelay: '1.5s' }}>

            <div className="w-2 h-2 bg-blue-300 rounded-full" />

          </div>

          <div className="absolute bottom-24 left-4 search-node" style={{ animationDelay: '0.5s' }}>

            <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />

          </div>

        </div>



        <div className="space-y-4 max-w-md">

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{headline}</h2>

          <p className="text-slate-500 font-medium">{subline}</p>



          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-6">

            <div

              className="bg-blue-600 h-full transition-all duration-700 ease-in-out"

              style={{ width: `${pct}%` }}

            />

          </div>



          {!isFailed ? (
            <div className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-widest text-blue-500 mt-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-ping" />
              <span>
                {stageLabel} · {locationLine}
              </span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                  Try again
                </button>
              )}
              {onContinue && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-white transition-colors"
                >
                  Continue to dashboard
                </button>
              )}
            </div>
          )}

        </div>

      </div>

    </div>

  );

}


