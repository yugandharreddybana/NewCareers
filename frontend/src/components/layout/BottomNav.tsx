import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Kanban as KanbanIcon, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban',    icon: KanbanIcon,      label: 'Tracker' },
  { to: '/profile',   icon: User,            label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border">
      <div className="flex items-center justify-around px-2 h-16 max-w-md mx-auto">
        {ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all',
              isActive
                ? 'text-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            )}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isActive && 'bg-brand-50'
                )}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-2xs font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
