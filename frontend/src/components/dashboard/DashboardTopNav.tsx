import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NavUsageLimits } from '@/components/dashboard/NavUsageLimits';

function firstName(full?: string | null): string {
  if (!full?.trim()) return 'U';
  return full.trim().split(/\s+/)[0]?.charAt(0).toUpperCase() ?? 'U';
}

export function DashboardTopNav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const isDashboard = location.pathname === '/dashboard';
  const isSettings = location.pathname === '/account';

  const navLinkClass = (active: boolean) =>
    `font-body-md text-body-md transition-colors whitespace-nowrap ${
      active ? 'text-primary font-medium' : 'text-secondary hover:text-primary'
    }`;

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      /* session cleared in finally */
    }
    navigate('/login', { replace: true });
    setSigningOut(false);
  }, [signOut, navigate, signingOut]);

  return (
    <nav className="w-full sticky top-0 z-50 bg-background border-b border-outline-variant shadow-sm">
      <div className="flex items-center h-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto gap-2 sm:gap-4">
        <Link
          to="/dashboard"
          className="font-headline-md text-headline-md font-bold text-primary shrink-0"
        >
          NewCareers
        </Link>
        <div className="flex flex-1 justify-center items-center gap-4 sm:gap-6 md:gap-gutter min-w-0">
          <Link to="/dashboard" className={navLinkClass(isDashboard)}>
            Dashboard
          </Link>
          <Link to="/jobs" className={navLinkClass(location.pathname.startsWith('/jobs') || location.pathname.startsWith('/kanban'))}>
            Jobs
          </Link>
          <span className="font-body-md text-body-md text-secondary/50 cursor-not-allowed whitespace-nowrap">
            Messages
          </span>
          <Link
            to="/networking"
            className={navLinkClass(location.pathname.startsWith('/networking'))}
          >
            Network
          </Link>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-base shrink-0">
          <NavUsageLimits />
          <button
            type="button"
            className="p-2 text-secondary hover:text-primary transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <Link
            to="/account"
            className={`p-2 transition-colors ${isSettings ? 'text-primary' : 'text-secondary hover:text-primary'}`}
            aria-label="Settings"
            aria-current={isSettings ? 'page' : undefined}
          >
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="p-2 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
            aria-label="Sign out"
            title="Sign out"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
          <span
            className="h-8 w-8 rounded-full bg-secondary-container overflow-hidden border border-outline-variant flex items-center justify-center text-on-secondary-container font-label-sm text-label-sm cursor-default select-none"
            aria-hidden
          >
            {firstName(user?.name)}
          </span>
        </div>
      </div>
    </nav>
  );
}
