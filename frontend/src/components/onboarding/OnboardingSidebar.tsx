import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const CHECKLIST = ['Basic Identity', 'Experience Mapping', 'Strategic Preferences'] as const;

const TRAJECTORY_BANDS = [
  {
    key: '0-2',
    height: '22%',
    tier: 'Entry',
    yearsLabel: '0–2 yrs',
    projection: 'Rapid skill ramp — foundation & first-role momentum',
  },
  {
    key: '3-5',
    height: '48%',
    tier: 'Mid',
    yearsLabel: '3–5 yrs',
    projection: 'Scope expansion — ownership of projects & small teams',
  },
  {
    key: '6-10',
    height: '68%',
    tier: 'Senior',
    yearsLabel: '6–10 yrs',
    projection: 'Strategic impact — cross-functional leadership track',
  },
  {
    key: '10+',
    height: '88%',
    tier: 'Lead',
    yearsLabel: '10+ yrs',
    projection: 'Executive trajectory — principal & director pathways',
  },
] as const;

type Props = {
  activeStep: number;
  profileCompleteness: number;
  experienceYears: string;
  step0Submitted: boolean;
};

function sectionComplete(
  index: number,
  activeStep: number,
  step0Submitted: boolean,
  profileCompleteness: number,
): boolean {
  if (index === 0) return step0Submitted || activeStep > 0;
  if (index === 1) return activeStep > 1;
  return profileCompleteness >= 100;
}

function checklistIconState(
  index: number,
  activeStep: number,
  step0Submitted: boolean,
  profileCompleteness: number,
) {
  if (sectionComplete(index, activeStep, step0Submitted, profileCompleteness)) {
    return { icon: 'check_circle', className: 'text-primary' };
  }
  if (index === activeStep) {
    return { icon: 'radio_button_unchecked', className: 'text-on-surface' };
  }
  return { icon: 'radio_button_unchecked', className: 'text-on-surface-variant' };
}

export function OnboardingSidebar({
  activeStep,
  profileCompleteness,
  experienceYears,
  step0Submitted,
}: Props) {
  const trajectory = useMemo(() => {
    const hasSelection = Boolean(
      experienceYears && TRAJECTORY_BANDS.some(b => b.key === experienceYears),
    );

    return TRAJECTORY_BANDS.map(band => ({
      ...band,
      isTarget: hasSelection && band.key === experienceYears,
    }));
  }, [experienceYears]);

  const projectionCopy = useMemo(() => {
    const match = TRAJECTORY_BANDS.find(b => b.key === experienceYears);
    if (match) return match.projection;
    return 'Select years of experience to personalize your career projection';
  }, [experienceYears]);

  const targetBand = trajectory.find(b => b.isTarget);

  return (
    <aside className="onboarding-shell__sidebar">
      <div className="mb-12">
        <div className="flex items-center gap-2 text-primary mb-8">
          <span className="material-symbols-outlined text-3xl onboarding-sidebar-icon" aria-hidden="true">
            rocket_launch
          </span>
          <Link
            to="/"
            className="font-headline-lg text-headline-lg tracking-tight text-primary hover:opacity-90 transition-opacity"
          >
            CareerOps
          </Link>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
                Profile Completeness
              </h3>
              <span className="font-headline-md text-headline-md text-primary onboarding-progress-value">
                {Math.round(profileCompleteness)}%
              </span>
            </div>
            <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
              <div
                className="h-full bg-primary onboarding-progress-fill transition-all duration-700 ease-out"
                style={{ width: `${profileCompleteness}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2">
              {CHECKLIST.map((label, index) => {
                const { icon, className } = checklistIconState(
                  index,
                  activeStep,
                  step0Submitted,
                  profileCompleteness,
                );

                return (
                  <li
                    key={label}
                    className={`flex items-center gap-2 text-body-md transition-colors duration-300 ${
                      index === activeStep ? 'text-on-surface' : 'text-on-surface-variant'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[18px] transition-colors duration-300 ${className}`}
                      aria-hidden="true"
                    >
                      {icon}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pt-8 border-t border-outline-variant">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
                Career Trajectory Projection
              </h3>
              {targetBand && experienceYears && (
                <span className="onboarding-trajectory__badge shrink-0">{targetBand.tier}</span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-outline mb-5 min-h-[2.5rem] transition-opacity duration-500">
              {projectionCopy}
            </p>
            <div className="onboarding-trajectory" key={experienceYears || 'default'}>
              {trajectory.map(bar => (
                <div key={bar.key} className="onboarding-trajectory__column">
                  <div
                    className={`onboarding-trajectory__bar ${
                      bar.isTarget
                        ? 'onboarding-trajectory__bar--target'
                        : 'onboarding-trajectory__bar--muted'
                    }`}
                    style={{ height: bar.height }}
                  >
                    {bar.isTarget && experienceYears && (
                      <div className="onboarding-trajectory__target">
                        <span className="material-symbols-outlined text-[10px]" aria-hidden="true">
                          trending_up
                        </span>
                        {bar.yearsLabel}
                      </div>
                    )}
                  </div>
                  <span
                    className={`onboarding-trajectory__tier ${
                      bar.isTarget && experienceYears ? 'onboarding-trajectory__tier--active' : ''
                    }`}
                  >
                    {bar.tier}
                  </span>
                </div>
              ))}
              <div className="onboarding-trajectory__baseline" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined" aria-hidden="true">
              shield_lock
            </span>
          </div>
          <div>
            <p className="font-label-md text-label-md text-on-surface">Secure Session</p>
            <p className="text-[11px] text-outline">AES-256 End-to-End Encryption</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
