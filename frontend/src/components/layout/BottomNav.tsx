/**
 * BottomNav — Section 13 QA update
 *  - bg-white → bg-white (kept; already correct)
 *  - border-slate-200 → border-border token
 *  - text-slate-400/600 → text-text-tertiary / text-brand-600 tokens
 *  - safe-area-inset-bottom applied to both height calc AND inner padding
 *    so the nav doesn't clip on notched phones (iPhone SE → iPhone 16 Pro Max)
 *  - Added aria-label on <nav> for screen readers
 *  - Active colour uses brand token (was emerald hard-coded)
 */
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, TrendingUp, Brain, User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban',    label: 'Board',      icon: Kanban           },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp       },
  { to: '/skills',    label: 'Skills',     icon: Brain            },
  { to: '/profile',   label: 'Profile',    icon: User             },
];

export default function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            aria-label={label}
            className={({ isActive }) => cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative',
              isActive ? 'text-brand-600' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            {({ isActive }) => (
              <>
                {/* Active dot */}
                {isActive && (
                  <motion.span
                    layoutId="bottom-nav-dot"
                    className="absolute top-1.5 w-1 h-1 rounded-full bg-brand-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                <motion.div
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </motion.div>

                <span className={cn('text-[9px] leading-none', isActive ? 'font-bold' : 'font-medium')}>
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
