import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Kanban as KanbanIcon, User,
  LogOut, ChevronLeft, ChevronRight, HelpCircle,
  Bell, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import Tooltip from '@/components/ui/Tooltip';
import { useState } from 'react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onHelpOpen: () => void;
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban',    icon: KanbanIcon,       label: 'Kanban' },
  { to: '/profile',  icon: User,             label: 'Profile' },
];

export default function Sidebar({ collapsed, onToggle, onHelpOpen }: SidebarProps) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    nav('/login');
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 flex-col bg-surface border-r border-border overflow-hidden"
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-14 px-4 border-b border-border flex-shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shadow-brand-lg flex-shrink-0">
              <Zap size={14} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-text-primary">
              Career<span className="text-brand">Ops</span>
            </span>
          </Link>
        )}
        {collapsed && (
          <Link to="/dashboard">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shadow-brand-lg">
              <Zap size={14} className="text-white" fill="white" />
            </div>
          </Link>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors flex-shrink-0',
            collapsed && 'absolute -right-3 top-[54px] bg-surface border border-border shadow-sm w-6 h-6 rounded-full z-10'
          )}
        >
          {collapsed
            ? <ChevronRight size={12} />
            : <ChevronLeft size={12} />
          }
        </button>
      </div>

      {/* Nav section label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Navigation</span>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto scrollbar-none">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          collapsed ? (
            <Tooltip key={to} content={label} side="right">
              <NavLink
                to={to}
                className={({ isActive }) => cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl mx-auto transition-all duration-150',
                  isActive
                    ? 'bg-brand-50 text-brand'
                    : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'
                )}
              >
                <Icon size={18} />
              </NavLink>
            </Tooltip>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-brand-50 text-brand font-semibold'
                  : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-brand-50 rounded-xl -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon size={17} />
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />
                  )}
                </>
              )}
            </NavLink>
          )
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-border space-y-0.5 flex-shrink-0">
        {collapsed ? (
          <>
            <Tooltip content="Help" side="right">
              <button
                onClick={onHelpOpen}
                className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto text-text-muted hover:bg-surface-3 hover:text-text-primary transition-colors"
              >
                <HelpCircle size={17} />
              </button>
            </Tooltip>
            <Tooltip content="Sign out" side="right">
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center w-10 h-10 rounded-xl mx-auto text-danger-500 hover:bg-danger-50 transition-colors"
              >
                <LogOut size={17} />
              </button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              onClick={onHelpOpen}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors"
            >
              <HelpCircle size={17} />
              <span>Help & FAQ</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-danger-500 hover:bg-danger-50 transition-colors"
            >
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </>
        )}

        {/* User avatar */}
        <div className={cn(
          'mt-2 pt-2 border-t border-border flex items-center gap-2.5',
          collapsed ? 'justify-center' : 'px-1'
        )}>
          <Avatar src={user?.avatarUrl} name={user?.name} size="sm" online />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-text-primary truncate">{user?.name}</p>
              <p className="text-[10px] text-text-muted truncate">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
