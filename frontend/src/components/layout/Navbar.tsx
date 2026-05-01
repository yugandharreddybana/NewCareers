/**
 * Navbar — wired NotificationsPanel bell icon (gap audit batch 2)
 *  - Bell button sits left of the avatar dropdown
 *  - Fetches unread count on mount for the badge
 *  - Closes on outside click (shared ref pattern)
 */
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Kanban, User, LogOut, Zap,
  TrendingUp, Brain, FileText, CreditCard, Settings, ChevronDown, Bell,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import NotificationsPanel from '@/components/NotificationsPanel';
import api from '@/services/api';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard',    exact: true  },
  { to: '/kanban',    label: 'Applications', exact: false },
  { to: '/analytics', label: 'Analytics',   exact: false },
  { to: '/skills',    label: 'Skills',       exact: false },
  { to: '/cv',        label: 'CV Manager',   exact: false },
  { to: '/profile',   label: 'Profile',      exact: false },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const nav      = useNavigate();
  const location = useLocation();

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [bellOpen,  setBellOpen]  = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Fetch unread notification count on mount
  useEffect(() => {
    api.get<{ unread: number }>('/api/notifications/unread-count')
      .then(res => setUnreadCount(res.data?.unread ?? 0))
      .catch(() => {});
  }, []);

  // Close both dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogout() {
    try { await signOut(); } catch {}
    nav('/login');
  }

  function isActive(to: string, exact: boolean) {
    return exact
      ? location.pathname === to
      : location.pathname.startsWith(to);
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-border
                       flex items-center px-6 gap-6">

      {/* Logo */}
      <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-brand">
          <Zap size={15} className="text-white" fill="white" />
        </div>
        <span className="font-bold text-[15px] text-text-primary tracking-tight font-display">
          Career<span className="text-brand-500">Ops</span>
        </span>
      </NavLink>

      {/* Nav links */}
      <nav className="flex items-center gap-0.5 flex-1">
        {NAV_LINKS.map(({ to, label, exact }) => {
          const active = isActive(to, exact);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                active
                  ? 'text-brand-700'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay',
              )}
            >
              {label}
              {active && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-brand-500"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Right side — bell + avatar */}
      <div className="flex items-center gap-2 shrink-0">

        {/* ── Bell / Notifications ── */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }}
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-text-secondary
                       hover:bg-surface-overlay hover:text-text-primary transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5
                               bg-brand-500 text-white text-[10px] font-bold
                               rounded-full flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0,  scale: 1    }}
                exit={{   opacity: 0, y: -6, scale: 0.96  }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-1.5 z-50"
              >
                <NotificationsPanel
                  onClose={() => setBellOpen(false)}
                  onMarkAllRead={() => setUnreadCount(0)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Avatar dropdown ── */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5
                       hover:bg-surface-overlay transition-colors"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <Avatar name={user?.name} size="sm" />
            <span className="text-sm font-medium text-text-primary max-w-[120px] truncate hidden lg:block">
              {user?.name ?? 'Account'}
            </span>
            <ChevronDown size={14} className={cn('text-text-tertiary transition-transform', menuOpen && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0,  scale: 1    }}
                exit={{   opacity: 0, y: -6, scale: 0.96  }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-border
                           rounded-2xl shadow-lg overflow-hidden z-50"
              >
                {/* User info */}
                <div className="px-3.5 py-3 border-b border-border">
                  <p className="text-xs font-semibold text-text-primary truncate">{user?.name}</p>
                  <p className="text-[11px] text-text-tertiary truncate">{user?.email}</p>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  <DropdownLink to="/billing"  icon={<CreditCard size={14} />} label="Billing & Plan"     onClick={() => setMenuOpen(false)} />
                  <DropdownLink to="/account"  icon={<Settings   size={14} />} label="Account Settings"  onClick={() => setMenuOpen(false)} />
                  <DropdownLink to="/profile"  icon={<User       size={14} />} label="Profile"            onClick={() => setMenuOpen(false)} />
                </div>

                {/* Sign out */}
                <div className="border-t border-border py-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium
                               text-danger-600 hover:bg-danger-50 transition-colors"
                  >
                    <LogOut size={14} />Sign out
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

function DropdownLink({
  to, icon, label, onClick,
}: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium
                 text-text-secondary hover:bg-surface-overlay hover:text-text-primary
                 transition-colors"
    >
      <span className="text-text-tertiary">{icon}</span>
      {label}
    </Link>
  );
}
