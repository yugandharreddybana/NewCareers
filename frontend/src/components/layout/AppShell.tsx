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
 * Phase 1 fix: accepts optional `children` prop so pages can be nested
 * directly inside <AppShell> instead of requiring React Router <Outlet>.
 * When children are provided they render instead of <Outlet>.
 *
 * Includes DevModeBanner in development when VITE_DEV_BYPASS_GUARDS=true.
 */
import React, { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import DevModeBanner from '@/components/ui/DevModeBanner';
import { Sparkles } from 'lucide-react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PageLoader } from '@/components/LoadingSpinner';

interface AppShellProps {
  children?: React.ReactNode;
  page?: string;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isKanban = location.pathname.startsWith('/kanban');

  const content = children ?? (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  );

  return (
    <div className="min-h-screen bg-[#f5f6fa] text-slate-900 dark:bg-slate-950 dark:text-slate-100">

      {/* ── Desktop Sidebar ── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ── Desktop TopBar ── */}
      <div className="hidden md:block">
        <TopBar />
      </div>

      {/* ── Mobile top brand bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 flex items-center px-4 bg-white border-b border-[#e2e8f0] dark:bg-slate-950 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#6366f1] rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-bold text-[15px] text-[#0f172a] dark:text-white font-display">
            Career<span className="text-[#6366f1]">Ops</span>
          </span>
        </div>
      </header>

      {/* ── Desktop content area ── */}
      <main
        className={`hidden md:block ${isKanban ? 'pt-[5px]' : 'pt-[60px] app-shell-content-offset'} min-h-screen`}
      >
        <div className="mx-auto px-6 py-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {content}
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
            {content}
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

// Named export for pages that import it as { AppShell }
export { AppShell };
