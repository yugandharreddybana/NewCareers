import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import { TooltipProvider } from '@/components/ui/Tooltip';

export default function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-surface-subtle">
        {/* Sidebar — desktop only */}
        <div className="hidden md:flex flex-col">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(v => !v)}
          />
        </div>

        {/* Main column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar sidebarCollapsed={sidebarCollapsed} />

          <main className="flex-1 overflow-y-auto">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <div className="max-w-[1200px] mx-auto px-6 py-6 pb-24 md:pb-6">
                <Outlet />
              </div>
            </motion.div>
          </main>
        </div>

        {/* Mobile bottom nav */}
        <BottomNav />
      </div>
    </TooltipProvider>
  );
}
