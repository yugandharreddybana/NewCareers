/**
 * Shared layout for login, signup, and password-reset pages.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND_NAME } from '@/lib/brand';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthPageShell({ children, footer }: Props) {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <div className="bg-surface-container-low min-h-screen flex flex-col antialiased text-on-surface w-full">
      <header className="flex items-center justify-center px-6 py-5 md:px-10">
        <Link
          to="/"
          className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight hover:opacity-90 transition-opacity"
        >
          {BRAND_NAME}
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-margin-mobile md:p-margin-desktop pb-12">
        <div className="w-full max-w-[440px]">{children}</div>
        {footer && <div className="w-full max-w-[440px] mt-6">{footer}</div>}
      </main>
    </div>
  );
}
