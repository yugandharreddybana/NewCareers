import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, KanbanSquare, TrendingUp,
  Brain, FileText, GraduationCap,
  BarChart2, Users, Share2,
  Zap, MessageSquare, Bell, MemoryStick, Layers,
  ChevronLeft, ChevronRight, Sparkles,
  User, Settings, Gift, CreditCard, HelpCircle, LogOut,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui';
import { Tooltip } from '@/components/ui';

interface NavItem {
  to:    string;
  icon:  React.ReactNode;
  label: string;
  id?:   string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/',            icon: <LayoutDashboard size={17} />, label: 'Dashboard' },
      { to: '/kanban',      icon: <KanbanSquare    size={17} />, label: 'Tracker'   },
      { to: '/analytics',   icon: <TrendingUp      size={17} />, label: 'Analytics' },
    ],
  },
  {
    label: 'AI Skills',
    items: [
      { to: '/skills',      icon: <Brain           size={17} />, label: 'Skills Coach'    },
      { to: '/cv',          icon: <FileText        size={17} />, label: 'CV Manager'      },
      { to: '/interviews',  icon: <GraduationCap   size={17} />, label: 'Interview Coach' },
      { to: '/progress',    icon: <BarChart2       size={17} />, label: 'Progress', id: 'nav-progress' },
    ],
  },
  {
    label: 'Career',
    items: [
      { to: '/networking',  icon: <Users           size={17} />, label: 'Networking'  },
      { to: '/workspaces',  icon: <Share2          size={17} />, label: 'Workspaces'  },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/auto-apply',      icon: <Zap           size={17} />, label: 'Auto-Apply'      },
      { to: '/outreach',        icon: <MessageSquare  size={17} />, label: 'Outreach'        },
      { to: '/watchlists',      icon: <Bell          size={17} />, label: 'Watchlists'      },
      { to: '/agent-memory',    icon: <MemoryStick   size={17} />, label: 'Agent Memory'    },
      { to: '/resume-versions', icon: <Layers        size={17} />, label: 'Resume Versions' },
    ],
  },
];

const PROFILE_MENU = [
  { to: '/profile',  icon: <User       size={15} />, label: 'My Profile'       },
  { to: '/account',  icon: <Settings   size={15} />, label: 'Account Settings' },
  { to: '/billing',  icon: <CreditCard size={15} />, label: 'Billing'          },
  { to: '/refer',    icon: <Gift       size={15} />, label: 'Refer & Earn'     },
  { to: '/profile',  icon: <HelpCircle size={15} />, label: 'Help & Support'   },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const width = collapsed ? 64 : 240;

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
  }, [width]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    try { await signOut(); } catch {}
    nav('/login');
  }

  return (
    <motion.aside
      animate={{ width }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 h-full bg-[#0f1117] flex flex-col z-30 overflow-hidden"
    >
      {/* ── Logo ── */}
      <div className={cn(
        "flex items-center h-[60px] shrink-0 border-b border-white/[0.06] justify-between",
        collapsed ? "px-1 gap-0.5" : "px-4"
      )}>
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 shrink-0 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles size={15} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="font-bold text-[15px] tracking-tight text-white whitespace-nowrap overflow-hidden"
              >
                CareerOps
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        <motion.button
          onClick={() => setCollapsed(c => !c)}
          className={cn(
            "ml-auto shrink-0 rounded-md flex items-center justify-center transition-colors",
            "text-white/30 hover:text-white/60 hover:bg-white/[0.06]",
            collapsed ? "w-5 h-5" : "w-6 h-6"
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={13} />}
        </motion.button>
      </div>

      {/* ── Navigation ── */}
      <nav
        className="flex-1 py-4 px-2 overflow-y-auto overflow-x-hidden space-y-5"
        style={{ scrollbarWidth: 'none' }}
      >
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="px-3 mb-1.5 text-[9px] font-bold tracking-[0.12em] text-white/25 uppercase"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Profile Section ── */}
      <div ref={profileRef} className="relative px-2 pb-3 pt-2 border-t border-white/[0.06]">
        {/* Dropdown menu (opens upward) */}
        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'absolute bottom-full mb-2 z-50',
                collapsed ? 'left-14 w-52' : 'left-2 right-2',
              )}
            >
              <div className="bg-[#1a1d27] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
                <div className="px-3.5 py-3 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white/90 truncate">{user?.name ?? 'User'}</p>
                  <p className="text-[10px] text-white/35 truncate mt-0.5">{user?.email ?? ''}</p>
                </div>
                <div className="py-1.5 px-1.5">
                  {PROFILE_MENU.map((item, i) => (
                    <Link
                      key={i}
                      to={item.to}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]
                                 text-white/55 hover:bg-white/[0.06] hover:text-white/85
                                 transition-colors"
                    >
                      <span className="text-white/35 shrink-0">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="px-1.5 pb-1.5 border-t border-white/[0.06] pt-1.5">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]
                               text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <LogOut size={14} className="shrink-0" />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile trigger */}
        <Tooltip content={user?.name ?? 'Profile'} placement="right" disabled={!collapsed}>
          <button
            onClick={() => setProfileOpen(o => !o)}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-all',
              profileOpen
                ? 'bg-white/[0.08]'
                : 'hover:bg-white/[0.05]',
              collapsed && 'justify-center px-2',
            )}
          >
            <Avatar name={user?.name} size="sm" className="shrink-0 ring-1 ring-white/10" />
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex-1 text-left overflow-hidden min-w-0"
                >
                  <p className="text-xs font-semibold text-white/85 truncate leading-tight">
                    {user?.name ?? 'Dev Tester'}
                  </p>
                  <p className="text-[10px] text-white/35 truncate leading-tight mt-0.5">
                    {user?.email ?? ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {!collapsed && (
              <ChevronUp
                size={12}
                className={cn(
                  'shrink-0 text-white/25 transition-transform duration-200',
                  profileOpen ? 'rotate-0' : 'rotate-180',
                )}
              />
            )}
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <Tooltip content={item.label} placement="right" disabled={!collapsed}>
      <NavLink
        id={item.id}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) => cn(
          'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium',
          'transition-all duration-150 group relative',
          isActive
            ? 'bg-indigo-500/[0.14] text-indigo-300'
            : 'text-white/45 hover:bg-white/[0.05] hover:text-white/75',
          collapsed && 'justify-center px-2',
        )}
      >
        {({ isActive }) => (
          <>
            <span className={cn(
              'shrink-0 transition-colors',
              isActive ? 'text-indigo-400' : 'text-white/35 group-hover:text-white/55',
            )}>
              {item.icon}
            </span>
            {!collapsed && (
              <span className="whitespace-nowrap overflow-hidden">
                {item.label}
              </span>
            )}
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-indigo-400 rounded-full"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}
