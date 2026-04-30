import { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Kanban as KanbanIcon, User, LogOut,
  Bell, HelpCircle, ChevronLeft, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import HelpDrawer from './HelpDrawer';

// ─── Nav item config ────────────────────────────────────────────────────

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban',    label: 'Kanban',    icon: KanbanIcon },
  { to: '/profile',   label: 'Profile',   icon: User },
];

// ─── AppShell ───────────────────────────────────────────────────────────

export default function AppShell() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    nav('/login');
  };

  return (
    <div className="flex h-full bg-bg">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col shrink-0',
          'bg-white border-r border-border',
          'transition-all duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-14 flex items-center border-b border-border px-4 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-brand shrink-0">
                <span className="text-white font-bold text-base leading-none">C</span>
              </div>
              <span className="font-bold text-lg text-text-primary tracking-tight">NewCareers</span>
            </Link>
          )}
          {collapsed && (
            <Link to="/dashboard">
              <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-brand">
                <span className="text-white font-bold text-base leading-none">C</span>
              </div>
            </Link>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-slate-100 hover:text-text-primary transition-all"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavItem
              key={to}
              to={to}
              label={label}
              icon={<Icon size={18} />}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className={cn(
          'border-t border-border p-2 space-y-0.5',
        )}>
          <Tooltip content="Help" side="right" disabled={!collapsed}>
            <button
              onClick={() => setHelpOpen(true)}
              className={cn(
                'sidebar-item w-full',
                collapsed && 'justify-center px-0'
              )}
            >
              <HelpCircle size={18} className="shrink-0" />
              {!collapsed && <span>Help</span>}
            </button>
          </Tooltip>

          <Tooltip content="Sign out" side="right" disabled={!collapsed}>
            <button
              onClick={handleSignOut}
              className={cn(
                'sidebar-item w-full hover:bg-danger-light hover:text-danger',
                collapsed && 'justify-center px-0'
              )}
            >
              <LogOut size={18} className="shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </Tooltip>

          {/* User chip */}
          <div className={cn(
            'mt-2 pt-2 border-t border-border flex items-center gap-2.5 px-2',
            collapsed && 'justify-center px-0'
          )}>
            <Avatar name={user?.name} size="sm" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{user?.name}</p>
                <p className="text-xs text-text-muted truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="pb-3 flex justify-center">
            <button
              onClick={() => setCollapsed(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-slate-100 hover:text-text-primary transition-all"
              aria-label="Expand sidebar"
            >
              <Menu size={15} />
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TopBar */}
        <TopBar
          user={user}
          onMenuOpen={() => setMobileOpen(true)}
          onHelpOpen={() => setHelpOpen(true)}
          onSignOut={handleSignOut}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
            <motion.div
              key={useLocation().pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>

      {/* ── Mobile Sidebar Drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-white border-r border-border flex flex-col md:hidden"
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-border">
                <Link to="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
                  <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-base">C</span>
                  </div>
                  <span className="font-bold text-lg text-text-primary">NewCareers</span>
                </Link>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 px-2 py-3 space-y-0.5">
                {NAV.map(({ to, label, icon: Icon }) => (
                  <NavItem
                    key={to}
                    to={to}
                    label={label}
                    icon={<Icon size={18} />}
                    collapsed={false}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
              <div className="border-t border-border p-2">
                <button
                  onClick={() => { handleSignOut(); setMobileOpen(false); }}
                  className="sidebar-item w-full hover:bg-danger-light hover:text-danger"
                >
                  <LogOut size={18} />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Mobile Bottom Nav ──────────────────────────────────────────────── */}
      <BottomNav />

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

// ─── NavItem ───────────────────────────────────────────────────────────

function NavItem({
  to, label, icon, collapsed, onClick,
}: {
  to: string; label: string; icon: React.ReactNode;
  collapsed: boolean; onClick?: () => void;
}) {
  return (
    <Tooltip content={label} side="right" disabled={!collapsed}>
      <NavLink to={to} onClick={onClick} className={({ isActive }) =>
        cn(isActive ? 'sidebar-item-active' : 'sidebar-item', 'w-full', collapsed && 'justify-center px-0')
      }>
        <span className="shrink-0">{icon}</span>
        {!collapsed && <span>{label}</span>}
      </NavLink>
    </Tooltip>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────

function TopBar({ user, onMenuOpen, onHelpOpen, onSignOut }: {
  user: any; onMenuOpen: () => void; onHelpOpen: () => void; onSignOut: () => void;
}) {
  const location = useLocation();
  const crumb = NAV.find(n => location.pathname.startsWith(n.to))?.label ?? 'NewCareers';

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sm:px-5 shrink-0">
      {/* Left: mobile menu + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-slate-100 transition-all"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="font-semibold text-text-primary">{crumb}</span>
        </div>
        {/* Mobile: show logo text */}
        <Link to="/dashboard" className="md:hidden flex items-center gap-2">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-bold text-base text-text-primary">NewCareers</span>
        </Link>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <Tooltip content="Help" side="bottom">
          <button
            onClick={onHelpOpen}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-slate-100 transition-all"
          >
            <HelpCircle size={18} />
          </button>
        </Tooltip>
        <Tooltip content="Notifications" side="bottom">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:bg-slate-100 transition-all">
            <Bell size={18} />
          </button>
        </Tooltip>
        <div className="w-px h-5 bg-border mx-1" />
        <Tooltip content={user?.name ?? ''} side="bottom">
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-slate-100 transition-all"
            aria-label="User menu"
          >
            <Avatar name={user?.name} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-text-primary">
              {user?.name?.split(' ')[0]}
            </span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

// ─── Bottom Nav (mobile only) ──────────────────────────────────────────

function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border h-16 flex items-center">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center gap-1 h-full transition-all',
              isActive ? 'text-brand' : 'text-text-muted'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn(
                'w-10 h-7 flex items-center justify-center rounded-full transition-all',
                isActive && 'bg-brand-light'
              )}>
                <Icon size={20} />
              </div>
              <span className="text-2xs font-medium">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
