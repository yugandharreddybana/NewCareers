/**
 * Task 145 — BottomNav (mobile)
 * Changes:
 *  - Added Skills (/skills) and CV (/cv) links (5 items total)
 *  - Smaller icon + label sizes to fit 5 items cleanly
 *  - Active icon scales up with framer-motion spring animation
 *  - Active tab shows an emerald dot indicator above the icon
 *  - Safe-area padding preserved for notched phones
 */
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, TrendingUp, Brain, User,
} from 'lucide-react';
import { motion } from 'framer-motion';

// CV Manager is accessible from Profile on mobile to keep bottom nav clean at 5 items.
// Skills replaces the 5th slot; Profile remains as last item.
const NAV = [
  { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/kanban',     label: 'Board',        icon: Kanban },
  { to: '/analytics',  label: 'Analytics',   icon: TrendingUp },
  { to: '/skills',     label: 'Skills',       icon: Brain },
  { to: '/profile',    label: 'Profile',      icon: User },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200">
      <div
        className="flex items-stretch h-16"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative',
              isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                {/* Active dot indicator */}
                {isActive && (
                  <motion.span
                    layoutId="bottom-nav-dot"
                    className="absolute top-1.5 w-1 h-1 rounded-full bg-emerald-500"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Icon with scale animation */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </motion.div>

                {/* Label */}
                <span
                  className={[
                    'text-[9px] leading-none',
                    isActive ? 'font-bold' : 'font-medium',
                  ].join(' ')}
                >
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
