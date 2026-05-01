import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import {
  LayoutDashboard, Kanban as KanbanIcon, User,
  LogOut, ChevronLeft, ChevronRight,
  Sparkles, HelpCircle, Gift, TrendingUp,
  Brain, FileText, CreditCard, Settings, GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { Tooltip } from '@/components/ui';

interface NavItem {
  to:     string;
  icon:   React.ReactNode;
  label:  string;
  badge?: string;
}

// ── Main navigation ────────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',  icon: <LayoutDashboard size={18} />, label: 'Dashboard'      },
  { to: '/kanban',     icon: <KanbanIcon       size={18} />, label: 'Tracker'        },
  { to: '/analytics',  icon: <TrendingUp       size={18} />, label: 'Analytics'      },
  { to: '/skills',     icon: <Brain            size={18} />, label: 'Skills Coach'   },
  { to: '/cv',         icon: <FileText         size={18} />, label: 'CV Manager'     },
  { to: '/interview',  icon: <GraduationCap    size={18} />, label: 'Interview Coach' },
  { to: '/profile',    icon: <User             size={18} />, label: 'Profile'        },
  { to: '/refer',      icon: <Gift             size={18} />, label: 'Refer & Earn'   },
  { to: '/billing',    icon: <CreditCard       size={18} />, label: 'Billing'        },
];

// ── Bottom / utility nav ────────────────────────────────────────────────────────────────
const BOTTOM_ITEMS: NavItem[] = [
  { to: '/account',       icon: <Settings    size={18} />, label: 'Account Settings' },
  { to: '/profile#help',  icon: <HelpCircle  size={18} />, label: 'Help'             },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const width = collapsed ? 64 : 240;

  return (
    <motion.aside
      animate={{ width }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 h-full bg-white border-r border-border
                 flex flex-col z-30 overflow-hidden"
    >
      {/* ── Logo ── */}
      <div className="flex items-center h-[60px] px-4 border-b border-border shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 shrink-0 bg-brand-500 rounded-lg flex items-center justify-center shadow-brand">
            <Sparkles size={16} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{   opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="font-bold text-[15px] tracking-tight text-text-primary
                           whitespace-nowrap overflow-hidden font-display"
              >
                CareerOps
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <motion.button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto shrink-0 w-6 h-6 rounded-md flex items-center justify-center
                     text-text-tertiary hover:text-text-secondary hover:bg-surface-overlay
                     transition-colors"
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronLeft  size={14} />
          }
        </motion.button>
      </div>

      {/* ── Main Nav ── */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="section-label px-2 mb-2">Navigation</p>
        )}
        {NAV_ITEMS.map(item => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* ── Bottom Section ── */}
      <div className="pb-3 px-2 border-t border-border pt-3 space-y-0.5">
        {BOTTOM_ITEMS.map(item => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}

        {/* Sign Out */}
        <Tooltip content="Sign out" placement="right" disabled={!collapsed}>
          <button
            onClick={async () => { try { await signOut(); } catch {} nav('/login'); }}
            className={cn(
              'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
              'text-text-secondary hover:bg-danger-50 hover:text-danger-600',
              collapsed && 'justify-center',
            )}
          >
            <LogOut size={18} className="shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{   opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="whitespace-nowrap"
                >
                  Sign out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </Tooltip>

        {/* User chip */}
        <div className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg mt-1',
          collapsed ? 'justify-center' : 'bg-surface-raised',
        )}>
          <Avatar name={user?.name} size="sm" className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{   opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="overflow-hidden"
              >
                <p className="text-xs font-semibold text-text-primary truncate max-w-[140px]">{user?.name}</p>
                <p className="text-[10px] text-text-tertiary truncate max-w-[140px]">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}

// ── SidebarLink ─────────────────────────────────────────────────────────────────────────────
function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <Tooltip content={item.label} placement="right" disabled={!collapsed}>
      <NavLink
        to={item.to}
        className={({ isActive }) => cn(
          'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium',
          'transition-all duration-150 group relative',
          isActive
            ? 'bg-brand-50 text-brand-600'
            : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary',
          collapsed && 'justify-center px-2',
        )}
      >
        {({ isActive }) => (
          <>
            <span className={cn(
              'shrink-0 transition-colors',
              isActive
                ? 'text-brand-500'
                : 'text-text-tertiary group-hover:text-text-secondary',
            )}>
              {item.icon}
            </span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{   opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
            {/* Active left-rail indicator */}
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-500 rounded-full"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}
