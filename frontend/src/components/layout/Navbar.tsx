import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Kanban, User, LogOut, Zap } from 'lucide-react';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/kanban',    label: 'Applications', icon: Kanban },
  { to: '/profile',   label: 'Profile',      icon: User },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

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
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-8">

      {/* Logo */}
      <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
          <Zap size={15} className="text-white" fill="white" />
        </div>
        <span className="font-bold text-[15px] text-slate-900 tracking-tight">
          Career<span className="text-emerald-500">Ops</span>
        </span>
      </NavLink>

      {/* Nav links */}
      <nav className="flex items-center gap-1 flex-1">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
              isActive
                ? 'bg-emerald-50 text-emerald-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
            ].join(' ')}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 font-medium transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
      </div>
    </header>
  );
}
