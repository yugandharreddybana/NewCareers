import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, Target, TrendingUp, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Target,     text: 'AI-matched jobs tailored to your profile' },
  { icon: TrendingUp, text: 'Real-time salary insights for Ireland' },
  { icon: Zap,        text: 'ATS-optimised CV generation in seconds' },
  { icon: Briefcase,  text: 'Track every application in one place' },
];

interface AuthLayoutProps {
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
  footer?:   React.ReactNode;
}

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-bg">
      {/* ── Brand panel (desktop only) ──────────────────────────────────── */}
      <div className="hidden lg:flex w-[480px] xl:w-[540px] shrink-0 flex-col justify-between
                      bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-400 p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-black/10 rounded-full" />

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">NewCareers</span>
        </Link>

        {/* Hero copy */}
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Land your next tech role faster.
          </h1>
          <p className="mt-4 text-white/75 text-lg leading-relaxed">
            AI-powered job matching, ATS-friendly CVs, and real-time insights — built for the Irish market.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-white" />
                </div>
                <span className="text-white/85 text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Social proof */}
        <p className="text-white/50 text-xs relative z-10">
          Trusted by 2,000+ job seekers in Ireland
        </p>
      </div>

      {/* ── Form panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-base">C</span>
            </div>
            <span className="font-bold text-lg text-text-primary">NewCareers</span>
          </div>

          <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}

          <div className="mt-7">{children}</div>

          {footer && (
            <p className="mt-6 text-center text-sm text-text-muted">{footer}</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
