/**
 * AppShell — Section 13 QA update
 *  - bg-surface-base token instead of hard-coded bg-slate-100
 *  - Mobile top bar uses border-border token
 *  - Safe-area-aware padding on main content (iOS notch)
 *  - BottomNav safe-area already handled inside BottomNav itself
 */
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar    from '@/components/layout/Navbar';
import Sidebar   from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-surface-base">

      {/* ── Desktop: full sidebar layout ── */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* ── Mobile: fixed top bar ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14
                   flex items-center justify-between px-4
                   bg-white border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <span className="font-bold text-[15px] text-text-primary font-display">
          Career<span className="text-brand-500">Ops</span>
        </span>
      </header>

      {/* ── Main content ── */}
      {/* pt-14 = clear fixed top bar (mobile + desktop); pb-20 = clear BottomNav on mobile */}
      <main
        className="md:pt-14 pt-14 pb-20 md:pb-0"
        style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          <motion.div
            key={typeof window !== 'undefined' ? window.location.pathname : undefined}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <BottomNav />
    </div>
  );
}
