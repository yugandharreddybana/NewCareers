const TRIAL_DAYS = 7;

const PRO_TRIAL_FEATURES = [
  '200 AI skill runs per month',
  'Unlimited job applications',
  'Up to 10 CV uploads',
  'Up to 5 team seats',
  'Mock interview coach & auto-apply tools',
] as const;

function formatTrialEndDate(daysFromNow: number): string {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysFromNow);
  return end.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export interface TrialStartedConfirmationProps {
  onContinue: () => void;
  continuing?: boolean;
}

export function TrialStartedConfirmation({
  onContinue,
  continuing = false,
}: TrialStartedConfirmationProps) {
  const trialEndLabel = formatTrialEndDate(TRIAL_DAYS);

  return (
    <div className="onboarding-card onboarding-card--trial-confirmation">
      <div className="onboarding-card__title">
        <h1>Your free trial has started</h1>
        <p>
          You now have <strong>Pro access for {TRIAL_DAYS} days</strong>. Your trial ends on{' '}
          <strong>{trialEndLabel}</strong>.
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-6">
        <p className="font-label-md text-label-md text-on-surface mb-3">
          Pro features included in your trial:
        </p>
        <ul className="space-y-2 font-body-md text-body-md text-on-surface-variant list-disc pl-5">
          {PRO_TRIAL_FEATURES.map(feature => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        className="btn btn-primary w-full sm:w-auto"
        onClick={onContinue}
        disabled={continuing}
      >
        {continuing ? 'Setting up your account…' : 'Continue onboarding'}
      </button>
    </div>
  );
}
