import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Kanban as KanbanIcon, User, LogOut,
  ChevronLeft, ChevronRight, Briefcase, HelpCircle, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban',    icon: KanbanIcon,      label: 'Kanban' },
  { to: '/profile',   icon: User,            label: 'Profile' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="relative flex flex-col h-full bg-white border-r border-border shrink-0 z-30"
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-[60px] px-4 border-b border-border shrink-0',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <Link to="/dashboard" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shadow-glow-sm shrink-0 group-hover:scale-105 transition-transform">
            <Briefcase size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="font-display font-bold text-base text-text-primary overflow-hidden whitespace-nowrap"
              >
                NewCareers
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {!collapsed && (
          <p className="section-title px-2 mb-2">Navigation</p>
        )}
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          collapsed ? (
            <Tooltip key={to} content={label} side="right">
              <NavLink
                to={to}
                className={({ isActive }) => cn(
                  'sidebar-item justify-center px-0 h-10',
                  isActive && 'sidebar-item-active'
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
                'sidebar-item',
                isActive && 'sidebar-item-active'
              )}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          )
        ))}
      </nav>

      {/* Bottom: Help + User */}
      <div className="px-2 pb-3 space-y-1 border-t border-border pt-3">
        {collapsed ? (
          <Tooltip content="Help" side="right">
            <button className="sidebar-item w-full justify-center px-0 h-10">
              <HelpCircle size={18} />
            </button>
          </Tooltip>
        ) : (
          <button className="sidebar-item w-full">
            <HelpCircle size={18} />
            <span>Help & Support</span>
          </button>
        )}

        {/* User row */}
        <div className={cn(
          'flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-ink-50 transition-colors cursor-pointer group',
          collapsed && 'justify-center px-0'
        )}>
          <Avatar name={user?.name} size="sm" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-xs font-semibold text-text-primary truncate">{user?.name}</p>
                <p className="text-2xs text-text-tertiary truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={async () => { await signOut(); nav('/login'); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-danger-500 ml-auto shrink-0"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-ink-50 transition-colors z-40"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
