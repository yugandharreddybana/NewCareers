const STEPS = [
  { label: 'Basic Info', short: '1' },
  { label: 'Experience', short: '2' },
  { label: 'Preferences', short: '3' },
] as const;

type Props = {
  activeStep: number;
  /** Core identity fields filled on step 0 (name, experience, location). */
  basicIdentityComplete?: boolean;
};

function stepVisualState(
  index: number,
  activeStep: number,
  basicIdentityComplete: boolean,
): 'completed' | 'active' | 'active-complete' | 'upcoming' {
  if (index < activeStep) return 'completed';
  if (index === activeStep) {
    if (index === 0 && basicIdentityComplete) return 'active-complete';
    return 'active';
  }
  return 'upcoming';
}

function connectorFilled(
  afterIndex: number,
  activeStep: number,
  basicIdentityComplete: boolean,
): boolean {
  if (afterIndex < activeStep) return true;
  if (afterIndex === 0 && activeStep === 0 && basicIdentityComplete) return true;
  return false;
}

export function OnboardingStepper({ activeStep, basicIdentityComplete = false }: Props) {
  return (
    <nav aria-label="Progress" className="onboarding-stepper">
      <ol className="onboarding-stepper__list" role="list">
        {STEPS.map((step, index) => {
          const state = stepVisualState(index, activeStep, basicIdentityComplete);
          const showCheck = state === 'completed' || state === 'active-complete';
          const lineFilled = connectorFilled(index, activeStep, basicIdentityComplete);
          const isLast = index === STEPS.length - 1;

          return (
            <li
              key={step.label}
              className={`onboarding-stepper__segment${
                !isLast && lineFilled ? ' onboarding-stepper__segment--line-filled' : ''
              }`}
            >
              <div
                className={`onboarding-stepper__item onboarding-stepper__item--${state}`}
                aria-current={state === 'active' || state === 'active-complete' ? 'step' : undefined}
              >
                <div className={`onboarding-stepper__node onboarding-stepper__node--${state}`}>
                  {showCheck ? (
                    <span className="material-symbols-outlined onboarding-stepper__check" aria-hidden="true">
                      check
                    </span>
                  ) : (
                    <span className="onboarding-stepper__digit">{step.short}</span>
                  )}
                  {(state === 'active' || state === 'active-complete') && (
                    <span className="onboarding-stepper__pulse" aria-hidden="true" />
                  )}
                </div>
                <span className="onboarding-stepper__label">{step.label}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
