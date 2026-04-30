import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar    from '@/components/layout/Navbar';
import BottomNav from '@/components/layout/BottomNav';

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-100">

      {/* Top navbar — desktop */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-white border-b border-slate-200">
        <span className="font-bold text-[15px] text-slate-900">
          Career<span className="text-emerald-500">Ops</span>
        </span>
      </header>

      {/* Main content — offset by navbar height (56px = h-14) */}
      <main className="md:pt-14 pt-14 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
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
    </div>
  );
}
