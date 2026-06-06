import { type ReactNode } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface AuthLayoutProps {
  children: ReactNode;
  title:    string;
  subtitle?: string;
  footer?:   ReactNode;
}

const TESTIMONIALS = [
  { text: 'Got 3 interviews in my first week. The match scoring is scarily accurate.', name: 'Aoife M.', role: 'Frontend Dev, Dublin' },
  { text: 'Finally a job tracker that actually helps me stay organised during the hunt.', name: 'Conor B.', role: 'Full-Stack Engineer' },
  { text: 'The AI cover letter tool alone is worth it. Saved me hours every application.', name: 'Priya S.', role: 'Data Analyst, Cork' },
];

const FALLBACK_TESTIMONIAL = {
  text: 'NewCareers keeps my job search organised and focused.',
  name: 'NewCareers Member',
  role: 'Active job seeker',
};

export function AuthLayout({ children, title, subtitle, footer }: AuthLayoutProps) {
  const tIndex = Math.floor(Date.now() / 1000 / 60 / 5) % TESTIMONIALS.length;
  const t = TESTIMONIALS[tIndex] ?? FALLBACK_TESTIMONIAL;

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex w-[45%] shrink-0 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-brand-900/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-white/5 rounded-full blur-2xl" />

        {/* Logo */}
        <Link to="/" className="relative flex items-center gap-2.5 group w-fit">
          <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="font-bold text-xl text-white tracking-tight font-display">NewCareers</span>
        </Link>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-white/90 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            AI-powered job matching for Ireland
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight text-balance font-display">
            Your next role is one smart application away.
          </h1>
          <p className="text-white/70 text-base leading-relaxed">
            Match your skills to real jobs. Track every application. Land interviews faster.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:gap-3 transition-all group"
          >
            Start for free
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5">
          <p className="text-white/85 text-sm leading-relaxed mb-3">&ldquo;{t.text}&rdquo;</p>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-xs">
              {t.name[0]}
            </div>
            <div>
              <p className="text-white text-xs font-semibold">{t.name}</p>
              <p className="text-white/60 text-[10px]">{t.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-surface-raised">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y:  0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-brand">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="font-bold text-base text-text-primary font-display">NewCareers</span>
          </Link>

          <div className="mb-7">
            <h2 className="text-2xl font-bold text-text-primary font-display">{title}</h2>
            {subtitle && <p className="text-sm text-text-secondary mt-1.5">{subtitle}</p>}
          </div>

          {children}

          {footer && <div className="mt-5 text-center text-sm text-text-secondary">{footer}</div>}
        </motion.div>
      </div>
    </div>
  );
}

AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;
