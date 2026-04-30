import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Kanban as KanbanIcon, User, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const items = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban',    icon: KanbanIcon,       label: 'Tracker' },
  { to: '/profile',  icon: User,             label: 'Profile' },
];

export default function BottomNav() {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border safe-area-inset">
      <nav className="flex items-center justify-around h-16 px-2">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-all duration-150',
              isActive ? 'text-brand' : 'text-text-muted'
            )}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  'w-9 h-6 flex items-center justify-center rounded-lg transition-all duration-150',
                  isActive && 'bg-brand-50'
                )}>
                  {isActive ? (
                    <motion.div layoutId={`bottom-nav-${to}`} className="contents">
                      <Icon size={18} strokeWidth={2.5} />
                    </motion.div>
                  ) : (
                    <Icon size={18} />
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
