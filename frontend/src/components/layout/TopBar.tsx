/**
 * TopBar — fixed top bar with breadcrumb, notifications,
 * and user profile avatar + sign-out dropdown in top-right.
 */
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Search, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const BREADCRUMBS: Record<string, { label: string; parent?: string; parentPath?: string }> = {
  '/':                { label: 'Dashboard' },
  '/dashboard':       { label: 'Dashboard' },
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
  '/account':         { label: 'Account Settings' },
  '/billing':         { label: 'Billing' },
  '/refer':           { label: 'Refer & Earn' },
  '/jobs':            { label: 'Job Detail', parent: 'Dashboard', parentPath: '/' },
  '/planner':         { label: 'Planner' },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const base  = '/' + pathname.split('/')[1];
  const crumb = BREADCRUMBS[pathname] ?? BREADCRUMBS[base] ?? { label: '' };

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  async function handleSignOut() {
    try { await signOut(); } catch {}
    nav('/login');
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex items-center justify-between',
        'h-[60px] px-5 bg-white/95 backdrop-blur-sm border-b border-border',
        'transition-all duration-200',
      )}
      style={{ left: 'var(--sidebar-width, 240px)' }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        {crumb.parent && (
          <>
            <Link
              to={crumb.parentPath!}
              className="text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {crumb.parent}
            </Link>
            <span className="text-text-tertiary">/</span>
          </>
        )}
        {crumb.label && (
          <span className="font-semibold text-text-primary">{crumb.label}</span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />

        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="icon"
          className="text-text-tertiary hover:text-text-primary"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Profile avatar + dropdown */}
        <div ref={dropRef} className="relative">
          <button
            onClick={() => setDropOpen(o => !o)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-xl
                       hover:bg-surface-raised transition-colors"
            aria-label="User menu"
          >
            <Avatar name={user?.name} size="sm" className="ring-1 ring-border" />
            <div className="hidden sm:block text-left leading-tight">
              <p className="text-xs font-semibold text-text-primary max-w-[90px] truncate">
                {user?.name ?? 'User'}
              </p>
            </div>
            <ChevronDown
              size={12}
              className={cn(
                'text-text-tertiary transition-transform duration-150 ml-0.5',
                dropOpen && 'rotate-180',
              )}
            />
          </button>

          <AnimatePresence>
            {dropOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border
                           rounded-xl shadow-xl shadow-black/[0.08] overflow-hidden z-50"
              >
                <div className="px-3.5 py-3 border-b border-border bg-surface-raised/50">
                  <p className="text-xs font-semibold text-text-primary truncate">{user?.name}</p>
                  <p className="text-[11px] text-text-tertiary truncate mt-0.5">{user?.email}</p>
                </div>

                <div className="py-1.5 px-1.5">
                  {[
                    { to: '/profile', icon: <User size={14} />, label: 'My Profile' },
                    { to: '/account', icon: <Settings size={14} />, label: 'Account Settings' },
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px]
                                 text-text-secondary hover:bg-surface-raised hover:text-text-primary
                                 transition-colors"
                    >
                      <span className="text-text-tertiary">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>

                <div className="px-1.5 pb-1.5 border-t border-border pt-1.5">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px]
                               text-danger-600 hover:bg-danger-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
