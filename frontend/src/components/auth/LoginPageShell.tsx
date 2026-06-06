/**
 * Split-panel layout for the login page (form left, intelligence visualizer right).
 */
import { useEffect, type ReactNode } from 'react';
import { AuthIntelligencePanel } from '@/components/auth/AuthIntelligencePanel';

type Props = {
  children: ReactNode;
};

export function LoginPageShell({ children }: Props) {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex font-sans text-gray-900 antialiased">
      <div className="w-full lg:w-1/2 bg-[#f3f4f6] flex items-center justify-center p-8 sm:p-12 lg:p-16 xl:p-20">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>

      <AuthIntelligencePanel />
    </div>
  );
}
