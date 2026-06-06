import { useEffect, type ReactNode } from 'react';
import { OnboardingSidebar } from '@/components/onboarding/OnboardingSidebar';

type Props = {
  children: ReactNode;
  activeStep: number;
  profileCompleteness: number;
  experienceYears: string;
  step0Submitted: boolean;
};

export function OnboardingPageShell({
  children,
  activeStep,
  profileCompleteness,
  experienceYears,
  step0Submitted,
}: Props) {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <main className="onboarding-shell">
      <OnboardingSidebar
        activeStep={activeStep}
        profileCompleteness={profileCompleteness}
        experienceYears={experienceYears}
        step0Submitted={step0Submitted}
      />
      <section className="onboarding-shell__content">{children}</section>
    </main>
  );
}
