/**
 * TopBar — fixed top bar with breadcrumb, notifications,
 * notifications, sign-out, and a non-interactive profile display in top-right.
 */
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { NavUsageLimits } from '@/components/dashboard/NavUsageLimits';

const BREADCRUMBS: Record<string, { label: string; parent?: string; parentPath?: string }> = {
  '/':                { label: 'Dashboard' },
  '/dashboard':       { label: 'Dashboard' },
  '/jobs':            { label: 'Job Tracker' },
  '/kanban':          { label: 'Job Tracker' },
  '/analytics':       { label: 'Analytics' },
  '/skills':          { label: 'Skills Coach' },
  '/cv':              { label: 'CV Manager' },
  '/interviews':      { label: 'Interview Coach' },
  '/progress':        { label: 'Progress' },
  '/networking':      { label: 'Networking' },
  '/workspaces':      { label: 'Workspaces' },
  '/auto-apply':      { label: 'Auto-Apply' },
  '/outreach':        { label: 'Outreach' },
  '/watchlists':      { label: 'Watchlists' },
  '/agent-memory':    { label: 'Agent Memory' },
  '/resume-versions': { label: 'Resume Versions' },
  '/profile':         { label: 'Profile' },
  '/account':         { label: 'Account Settings', parent: 'Dashboard', parentPath: '/dashboard' },
  '/account/profile': { label: 'Profile', parent: 'Account Settings', parentPath: '/account/profile' },
  '/account/security': { label: 'Security', parent: 'Account Settings', parentPath: '/account/profile' },
  '/account/billing': { label: 'Billing', parent: 'Account Settings', parentPath: '/account/profile' },
  '/account/notifications': { label: 'Notifications', parent: 'Account Settings', parentPath: '/account/profile' },
  '/account/team': { label: 'Team', parent: 'Account Settings', parentPath: '/account/profile' },
  '/billing':         { label: 'Billing' },
  '/refer':           { label: 'Refer & Earn' },
  '/planner':         { label: 'Planner' },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const base  = '/' + pathname.split('/')[1];
  const crumb = BREADCRUMBS[pathname] ?? BREADCRUMBS[base] ?? { label: '' };

  async function handleSignOut() {
    try { await signOut(); } catch {}
    nav('/login');
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex items-center justify-between',
        'topbar-shell-offset',
        'h-[60px] px-5 bg-white/95 backdrop-blur-sm border-b border-border dark:bg-slate-950/95 dark:border-white/10',
        'transition-all duration-200',
      )}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        {crumb.parent && (
          <>
            <Link
              to={crumb.parentPath!}
              className="text-text-tertiary transition-colors hover:text-text-secondary dark:text-slate-400 dark:hover:text-slate-200"
            >
              {crumb.parent}
            </Link>
            <span className="text-text-tertiary dark:text-slate-500">/</span>
          </>
        )}
        {crumb.label && (
          <span className="font-semibold text-text-primary dark:text-white">{crumb.label}</span>
        )}
      </div>

      {/* Usage + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <NavUsageLimits />
        <NotificationBell />

        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="icon"
          className="text-text-tertiary hover:text-text-primary dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1 dark:bg-white/10" />

        {/* Profile display only — not clickable */}
        <div
          className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-xl cursor-default select-none"
          aria-hidden
        >
          <Avatar name={user?.name || ''} size="sm" className="ring-1 ring-border" />
          <div className="hidden sm:block text-left leading-tight">
            <p className="text-xs font-semibold text-text-primary dark:text-white max-w-[90px] truncate">
              {user?.name ?? 'User'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
