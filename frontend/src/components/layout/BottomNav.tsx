import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Kanban as KanbanIcon, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban',    icon: KanbanIcon,       label: 'Tracker'   },
  { to: '/profile',   icon: User,             label: 'Profile'   },
] as const;

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 min-w-[56px] py-2 rounded-xl transition-all duration-150',
              isActive ? 'text-brand-500' : 'text-text-tertiary',
            )}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150',
                  isActive ? 'bg-brand-50' : '',
                )}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                </div>
                <span className={cn('text-[10px] font-semibold tracking-tight', isActive ? 'text-brand-500' : 'text-text-tertiary')}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
