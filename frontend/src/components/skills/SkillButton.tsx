import { SkillState } from '@/types';
import { Loader2, CheckCircle2, Lock, AlertCircle, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  label: string;
  icon?: React.ReactNode;
  state: SkillState;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export default function SkillButton({ label, icon, state, onClick, disabled, className }: Props) {
  const isDisabled = disabled || state === 'loading' || state === 'locked';

  const styles: Record<SkillState, { bg: string, text: string, border: string, icon: React.ReactNode }> = {
    idle: { 
      bg: 'bg-white hover:bg-slate-50', 
      text: 'text-slate-700', 
      border: 'border-slate-200 hover:border-brand-vibrant/30',
      icon: icon || <Play size={14} className="text-slate-400 group-hover:text-brand-vibrant" />
    },
    loading: { 
      bg: 'bg-brand-vibrant/5', 
      text: 'text-brand-vibrant', 
      border: 'border-brand-vibrant/20',
      icon: <Loader2 size={14} className="animate-spin" />
    },
    done: { 
      bg: 'bg-emerald-50 hover:bg-emerald-100', 
      text: 'text-emerald-700', 
      border: 'border-emerald-200',
      icon: <CheckCircle2 size={14} />
    },
    locked: { 
      bg: 'bg-slate-50 opacity-60', 
      text: 'text-slate-400', 
      border: 'border-slate-200',
      icon: <Lock size={14} />
    },
    error: { 
      bg: 'bg-rose-50 hover:bg-rose-100', 
      text: 'text-rose-700', 
      border: 'border-rose-200',
      icon: <AlertCircle size={14} />
    },
  };

  const current = styles[state];

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={`
        group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider
        transition-all duration-300 border shadow-sm active:scale-95
        ${current.bg} ${current.text} ${current.border} ${className || ''}
      `}
    >
      <div className={`shrink-0 flex items-center justify-center transition-transform group-hover:scale-110`}>
        {current.icon}
      </div>
      
      <span className="flex-1 truncate text-left">
        {state === 'loading' ? labelToLoading(label) : label}
      </span>

      {state === 'done' && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
        />
      )}
    </button>
  );
}

function labelToLoading(label: string): string {
  const map: Record<string, string> = {
    'Full Evaluation':   'Evaluating',
    'Tailor My CV':      'Tailoring',
    'Research Company':  'Researching',
    'Draft Outreach':    'Drafting',
    'Apply Assistant':   'Preparing',
    'Prep Interview':    'Building kit',
    'Compare All':       'Comparing',
    'Triage All':        'Triaging',
  };
  return map[label] ?? label + '...';
}
