/**
 * AppShell — restored to Sidebar + TopBar layout
 * The Navbar-only rewrite broke the header/sidebar visibility.
 * This restores the original architecture:
 *   Desktop: fixed Sidebar (240px collapsible) + fixed TopBar offset by sidebar width
 *   Mobile:  fixed top brand bar + BottomNav (no sidebar)
 */
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar   from '@/components/layout/Sidebar';
import TopBar    from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';

export default function AppShell() {
  return (
    <>
      {/* ── Desktop: Sidebar ── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ── Desktop: TopBar (offset right of sidebar) ── */}
      <div className="hidden md:block">
        <TopBar />
      </div>

      {/* ── Mobile: fixed top brand bar ── */}
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

      {/* ── Main content area ── */}
      {/*
        Desktop: push content right of sidebar (240px default) and below TopBar (60px)
        Mobile:  push content below fixed top bar (56px) and above BottomNav (use pb-20)
        The sidebar sets --sidebar-width on :root via its own animate, so we use the
        CSS variable with a safe fallback of 240px.
      */}
      <main
        className="min-h-screen bg-surface-base transition-all duration-200
                   pt-14 md:pt-[60px] pb-20 md:pb-0"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        {/* Desktop: offset content right of sidebar */}
        <div
          className="hidden md:block h-full"
          style={{ marginLeft: 'var(--sidebar-width, 240px)' }}
        >
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6">
            <motion.div
              key={typeof window !== 'undefined' ? window.location.pathname : undefined}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </div>
        </div>

        {/* Mobile: full width content */}
        <div className="md:hidden">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <motion.div
              key={typeof window !== 'undefined' ? window.location.pathname : undefined}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </div>
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <BottomNav />
    </>
  );
}
