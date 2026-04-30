import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Zap, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const HIGHLIGHTS = [
  'AI-powered job matching for the Irish market',
  'Tailored ATS-optimised CVs in seconds',
  'Track every application in one place',
  'Salary negotiation & interview prep tools',
];

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ───────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-10
                      bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 relative overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #ffffff 0, transparent 50%), radial-gradient(circle at 80% 80%, #c7d2fe 0, transparent 50%)' }}
        />
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-brand-900/30 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">CareerOps</span>
        </div>

        {/* Middle content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Built for Irish job seekers
            </span>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Land your next role<br />faster than ever
            </h2>
            <p className="text-white/70 text-sm leading-relaxed max-w-xs">
              CareerOps uses AI to match you to the right jobs, build ATS-optimised CVs, and track every application — all in one place.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className="flex items-start gap-2.5 text-sm text-white/85"
              >
                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                {h}
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-white/40">
          &copy; {new Date().getFullYear()} CareerOps. Made in Ireland.
        </p>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 px-6 py-5 border-b border-border">
          <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center">
            <Zap size={13} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-sm">Career<span className="text-brand">Ops</span></span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-full max-w-[400px] space-y-6"
          >
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
            </div>
            {children}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border text-center">
          <p className="text-[11px] text-text-muted">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="underline hover:text-text-primary">Terms</Link>{' '}
            and{' '}
            <Link to="/privacy" className="underline hover:text-text-primary">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
