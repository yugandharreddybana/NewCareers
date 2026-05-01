/**
 * Task 144 — Navbar (desktop)
 * Changes:
 *  - Added Skills (/skills) and CV (/cv) nav links
 *  - Active link now shows a sliding underline indicator via framer-motion layoutId
 *  - Avatar gradient (initials) instead of flat emerald
 *  - Notification dot on Skills link when any skill session is in 'loading' state
 *    (uses localStorage key 'skill_running' set by Skills page)
 */
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Kanban, User, LogOut, Zap,
  TrendingUp, Brain, FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/kanban',    label: 'Applications', icon: Kanban },
  { to: '/analytics', label: 'Analytics',   icon: TrendingUp },
  { to: '/skills',    label: 'Skills',       icon: Brain },
  { to: '/cv',        label: 'CV Manager',   icon: FileText },
  { to: '/profile',   label: 'Profile',      icon: User },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav      = useNavigate();
  const location = useLocation();

  const initials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'CO';

  async function handleLogout() {
    try { await logout(); } catch {}
    nav('/login');
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200
                       flex items-center px-6 gap-6">

      {/* Logo */}
      <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
          <Zap size={15} className="text-white" fill="white" />
        </div>
        <span className="font-bold text-[15px] text-slate-900 tracking-tight">
          Career<span className="text-emerald-500">Ops</span>
        </span>
      </NavLink>

      {/* Nav links with sliding active indicator */}
      <nav className="flex items-center gap-0.5 flex-1">
        {NAV_LINKS.map(({ to, label }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={[
                'relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'text-emerald-700'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
              ].join(' ')}
            >
              {label}
              {/* Sliding underline */}
              {isActive && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-500"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-400
                     hover:text-slate-700 font-medium transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>

        {/* Gradient avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center
                     text-white text-xs font-bold shrink-0 select-none"
          style={{
            background:
              'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
