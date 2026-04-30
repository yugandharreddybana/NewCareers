import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar   from '@/components/layout/Sidebar';
import TopBar    from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import HelpDrawer from '@/components/layout/HelpDrawer';
import { useState } from 'react';

export default function AppShell() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* TopBar — desktop only */}
      <div className="hidden md:block">
        <TopBar />
      </div>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 bg-white border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center shadow-brand">
            <span className="text-white font-bold text-sm font-display">C</span>
          </div>
          <span className="font-bold text-[15px] tracking-tight text-text-primary font-display">CareerOps</span>
        </div>
      </header>

      {/* Main content area */}
      <main
        className={[
          'transition-all duration-200',
          // Desktop: offset by sidebar + topbar
          'md:pl-[240px] md:pt-[60px]',
          // Mobile: offset by top bar + bottom nav
          'pt-14 pb-20 md:pb-0',
        ].join(' ')}
      >
        <div className="min-h-[calc(100vh-60px)] px-4 md:px-6 lg:px-8 py-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
