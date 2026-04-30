import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Kanban, User, TrendingUp } from 'lucide-react';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/kanban',     label: 'Applications',  icon: Kanban },
  { to: '/analytics',  label: 'Analytics',    icon: TrendingUp },
  { to: '/profile',    label: 'Profile',       icon: User },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
      <div className="flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
              isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-${isActive ? 'bold' : 'medium'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
