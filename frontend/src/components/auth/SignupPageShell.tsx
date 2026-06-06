/**
 * Split-panel layout for the signup page (form left, executive analytics right).
 */
import { useEffect, type ReactNode } from 'react';
import { SignupAnalyticsPanel } from '@/components/auth/SignupAnalyticsPanel';
import '@/styles/signup-page.css';

type Props = {
  children: ReactNode;
};

export function SignupPageShell({ children }: Props) {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <div className="signup-page signup-page--split flex min-h-dvh w-full flex-col overflow-x-hidden bg-surface font-body-md text-on-surface antialiased md:max-h-dvh md:flex-row md:overflow-hidden">
      <div className="signup-page__form relative z-10 flex w-full shrink-0 flex-col items-center border-r border-surface-variant bg-surface-container-lowest px-8 py-10 md:min-h-0 md:w-[45%] md:flex-1 md:overflow-y-auto md:overscroll-y-contain lg:w-[40%] lg:px-16 lg:py-12">
        <div className="flex w-full min-w-0 max-w-[440px] flex-col gap-8 py-2 md:my-auto">{children}</div>
      </div>

      <SignupAnalyticsPanel />
    </div>
  );
}
