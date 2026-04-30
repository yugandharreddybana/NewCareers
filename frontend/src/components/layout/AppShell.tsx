import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/Tooltip';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import BottomNav from '@/components/layout/BottomNav';
import HelpDrawer from '@/components/layout/HelpDrawer';

export default function AppShell() {
  const [collapsed, setCollapsed]   = useState(false);
  const [helpOpen, setHelpOpen]     = useState(false);

  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-surface-2">
        {/* Sidebar — desktop only */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onHelpOpen={() => setHelpOpen(true)}
        />

        {/* Top bar */}
        <TopBar sidebarCollapsed={collapsed} />

        {/* Main content area */}
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarWidth }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="hidden md:block min-h-screen pt-14"
        >
          <div className="max-w-7xl mx-auto px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              key={typeof window !== 'undefined' ? window.location.pathname : 'page'}
            >
              <Outlet />
            </motion.div>
          </div>
        </motion.main>

        {/* Mobile main — no sidebar margin */}
        <main className="md:hidden min-h-screen pt-14 pb-20">
          <div className="px-4 py-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <BottomNav />

        {/* Help drawer */}
        <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </TooltipProvider>
  );
}
