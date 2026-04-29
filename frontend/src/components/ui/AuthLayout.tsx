import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AuthLayout({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-vibrant/10 blur-[150px] rounded-full -z-10" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-500/10 blur-[150px] rounded-full -z-10" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center group">
            <div className="w-12 h-12 bg-brand-vibrant rounded-2xl flex items-center justify-center shadow-glow mb-3 group-hover:rotate-12 transition-transform">
               <Sparkles className="text-white" size={24} />
            </div>
            <h2 className="text-3xl font-black tracking-tighter gradient-text">CareerOps</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Intelligence for your Career</p>
          </Link>
        </div>

        <div className="glass-card p-8 sm:p-10 shadow-premium border-white/50">
          <div className="space-y-1 mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm font-medium text-slate-500">{subtitle}</p>}
          </div>
          
          <div className="relative">
            {children}
          </div>
        </div>

        {footer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm font-medium text-slate-500 mt-6"
          >
            {footer}
          </motion.div>
        )}
      </motion.div>
      
      <footer className="absolute bottom-8 text-center w-full">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          &copy; 2026 CareerOps &middot; All Rights Reserved
        </p>
      </footer>
    </div>
  );
}
