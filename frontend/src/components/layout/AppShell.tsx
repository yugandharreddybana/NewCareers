/**
 * AppShell — Sidebar + TopBar layout
 *
 * Desktop (md+):
 *   - Fixed Sidebar on the left (240px, collapsible to 64px)
 *   - Fixed TopBar across the top-right (offset by --sidebar-width)
 *   - Main content: margin-left = sidebar width, padding-top = topbar height
 *
 * Mobile (<md):
 *   - Fixed thin top brand bar
 *   - Full-width scrollable content
 *   - Fixed BottomNav
 *
 * Includes DevModeBanner in development when VITE_DEV_BYPASS_GUARDS=true.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar   from '@/components/layout/Sidebar';
import TopBar    from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import DevModeBanner from '@/components/ui/DevModeBanner';
import { Sparkles } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/LoadingSpinner';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-[#f5f6fa]">

      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ── Desktop TopBar ── */}
      <div className="hidden md:block">
        <TopBar />
      </div>

      {/* ── Mobile top brand bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4 bg-white border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#6366f1] rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-bold text-[15px] text-[#0f172a] font-display">
            Career<span className="text-[#6366f1]">Ops</span>
          </span>
        </div>
      </header>

      {/* ── Desktop content area ── */}
      <main
        className="hidden md:block pt-[60px] min-h-screen"
        style={{ marginLeft: 'var(--sidebar-width, 240px)' }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>

      {/* ── Mobile content area ── */}
      <main className="md:hidden pt-14 pb-20 min-h-screen">
        <div className="max-w-full px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </motion.div>
        </div>
      </main>

      {/* ── Mobile BottomNav ── */}
      <div className="md:hidden">
        <BottomNav />
      </div>

      {/* ── Dev Mode Banner ── */}
      <DevModeBanner />

    </div>
  );
}

