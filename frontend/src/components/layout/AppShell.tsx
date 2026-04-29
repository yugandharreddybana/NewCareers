import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { LayoutDashboard, Kanban as KanbanIcon, User, LogOut, HelpCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HelpDrawer from '@/components/layout/HelpDrawer';

export default function AppShell() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const greet = greeting();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-vibrant/10 blur-[120px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/5 blur-[120px] rounded-full -z-10" />

      <header className="sticky top-4 z-40 mx-auto w-[calc(100%-2rem)] max-w-6xl">
        <nav className="glass-card px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-brand-vibrant rounded-lg flex items-center justify-center shadow-glow group-hover:rotate-12 transition-transform">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="font-bold text-xl tracking-tight gradient-text">CareerOps</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-1">
              <NavTab to="/dashboard" icon={<LayoutDashboard size={18} />}>Dashboard</NavTab>
              <NavTab to="/kanban" icon={<KanbanIcon size={18} />}>Kanban</NavTab>
              <NavTab to="/profile" icon={<User size={18} />}>Profile</NavTab>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex flex-col items-end mr-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{greet}</span>
              <span className="text-sm font-semibold text-slate-700">{user?.name?.split(' ')[0]}</span>
            </div>
            
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <button 
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle size={20} />
              </button>
              <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
                <Bell size={20} />
              </button>
              <button 
                onClick={async () => { await signOut(); nav('/login'); }}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-50 text-rose-500 transition-colors ml-1"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </main>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      
      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
        <div className="glass-card h-16 flex items-center justify-around px-2 shadow-premium">
          <MobileNavTab to="/dashboard" icon={<LayoutDashboard size={20} />} />
          <MobileNavTab to="/kanban" icon={<KanbanIcon size={20} />} />
          <MobileNavTab to="/profile" icon={<User size={20} />} />
        </div>
      </div>
    </div>
  );
}

function NavTab({ to, children, icon }: { to: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
          isActive ? 'text-brand-vibrant' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {icon}
          {children}
          {isActive && (
            <motion.div
              layoutId="nav-pill"
              className="absolute inset-0 bg-brand-vibrant/10 rounded-xl -z-10"
              transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

function MobileNavTab({ to, icon }: { to: string; icon: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `w-12 h-12 flex items-center justify-center rounded-xl transition-all ${
          isActive ? 'bg-brand-vibrant text-white shadow-glow' : 'text-slate-400'
        }`
      }
    >
      {icon}
    </NavLink>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
