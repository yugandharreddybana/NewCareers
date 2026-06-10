import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/authCtx';
import { BRAND_NAME } from '@/lib/brand';

export type MarketingActiveLink = 'home' | 'pricing' | 'features' | 'blog';

interface MarketingNavProps {
  activeLink?: MarketingActiveLink;
}

const linkBase =
  'font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors hover:bg-surface-variant/50 transition-all duration-200 px-3 py-2 rounded-md';

const linkActive = 'font-body-md text-body-md text-primary font-bold border-b-2 border-primary pb-1';

export const MarketingNav: React.FC<MarketingNavProps> = ({ activeLink }) => {
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobile = () => setMobileMenuOpen(false);

  const navItems: Array<{
    key: MarketingActiveLink | 'howItWorks';
    label: string;
    to?: string;
    href?: string;
  }> = [
    { key: 'features', label: 'Features', to: '/#features' },
    { key: 'pricing', label: 'Pricing', to: '/pricing' },
    { key: 'howItWorks', label: 'How It Works', to: '/#features' },
    { key: 'blog', label: 'Blog', href: '#' },
  ];

  const linkClass = (key: string) =>
    activeLink === key ? linkActive : linkBase;

  const appEntryHref = user?.onboarded ? '/dashboard' : '/onboarding';
  const appEntryLabel = user?.onboarded ? 'Dashboard' : 'Continue setup';

  const authActions = loading ? (
    <span className="hidden md:inline font-label-md text-label-md text-on-surface-variant px-4 py-2">
      …
    </span>
  ) : user ? (
    <>
      <Link
        className="hidden md:inline-flex font-label-md text-label-md text-on-surface hover:bg-surface-variant/50 transition-all duration-200 px-4 py-2 rounded-md border border-outline-variant"
        to={appEntryHref}
      >
        {appEntryLabel}
      </Link>
      <button
        type="button"
        className="hidden md:inline-flex font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors px-3 py-2"
        onClick={() => void signOut()}
      >
        Log out
      </button>
    </>
  ) : (
    <>
      <Link
        className="hidden md:inline-flex font-label-md text-label-md text-on-surface hover:bg-surface-variant/50 transition-all duration-200 px-4 py-2 rounded-md border border-outline-variant"
        to="/login"
      >
        Log In
      </Link>
      <Link
        className="font-label-md text-label-md bg-primary text-on-primary px-4 py-2 rounded-md btn-glow transition-all duration-200 shadow-sm"
        to="/get-started"
      >
        Start Free
      </Link>
    </>
  );

  return (
    <div className="fixed top-[var(--status-banner-height,0px)] w-full z-50 flex flex-col bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm transition-[top] duration-200">
      <nav className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 max-w-container-max mx-auto w-full">
        <Link
          className="font-headline-md text-headline-md font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
          to="/"
        >
          {BRAND_NAME}
        </Link>

        <div className="hidden md:flex gap-gutter items-center">
          {navItems.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                className={linkClass(item.key === 'howItWorks' ? 'features' : item.key)}
                to={item.to}
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.label} className={linkClass(item.key)} href={item.href}>
                {item.label}
              </a>
            ),
          )}
        </div>

        <div className="flex items-center gap-stack-md">
          {authActions}
          <button
            type="button"
            className="md:hidden text-on-surface p-2 rounded hover:bg-surface-container transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden w-full border-t border-outline-variant/30 bg-surface/95 backdrop-blur-xl py-4 px-margin-mobile shadow-lg">
          <div className="max-w-container-max mx-auto flex flex-col gap-4">
            {navItems.map((item) =>
              item.to ? (
                <Link
                  key={item.label}
                  className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                  to={item.to}
                  onClick={closeMobile}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                  href={item.href}
                  onClick={closeMobile}
                >
                  {item.label}
                </a>
              ),
            )}
            <hr className="border-outline-variant/30" />
            {loading ? null : user ? (
              <>
                <Link
                  className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                  to={appEntryHref}
                  onClick={closeMobile}
                >
                  {appEntryLabel}
                </Link>
                <button
                  type="button"
                  className="font-label-md text-label-md text-left text-on-surface-variant hover:text-primary transition-colors"
                  onClick={() => {
                    closeMobile();
                    void signOut();
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors"
                to="/login"
                onClick={closeMobile}
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
