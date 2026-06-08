import { type ReactNode } from 'react';
import {
  AlertTriangle,
  LayoutGrid,
  LineChart,
  Share2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CARD_CAREER_ANALYSIS,
  CARD_CAREER_ANALYSIS_PROGRESS,
  CARD_CAREER_INSIGHTS,
  CARD_CAREER_PATH_TITLE,
  CARD_CAREER_SCORE,
  CARD_CAREER_STAT,
  CARD_LIVE_BADGE,
  CARD_MATCH_DESCRIPTION,
  CARD_MATCH_LABEL,
  CARD_MATCH_PROGRESS,
  CARD_MATCH_SCORE,
  CARD_MATCH_WORD,
  CARD_NESTED_SKILL_GAP_TITLE,
  CARD_PEER_COMPARISONS,
  CARD_SKILL_GAP_BULLETS,
  CARD_SKILL_GAP_TITLE,
  CARD_SKILL_ROW1_PROGRESS,
  CARD_SKILL_ROW2_TEAL,
  CARD_WORK_PREDICTIONS,
  INTELLIGENCE_HERO_LINE_1,
  INTELLIGENCE_HERO_LINE_2,
  INTELLIGENCE_SUITE_LABEL,
  LOGIN_AVATARS,
} from '@/components/auth/intelligencePanelCopy';

const TEAL = '#4fd1c5';

const GLASS =
  'rounded-2xl border border-white/20 bg-gradient-to-br from-white/[0.14] to-white/[0.04] backdrop-blur-[20px] backdrop-saturate-[1.4] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_24px_48px_rgba(0,0,0,0.38)]';

type GlassCardProps = {
  children: ReactNode;
  className?: string;
  rotate?: number;
  hoverRotate?: number;
  delay?: number;
  zIndex?: number;
};

function GlassCard({
  children,
  className = '',
  rotate = 0,
  hoverRotate = 0,
  delay = 0,
  zIndex = 10,
}: GlassCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={`${GLASS} ${className}`}
      style={{ rotate, zIndex }}
      {...(reduce
        ? {}
        : {
            animate: { y: [0, -7, 0] },
            transition: {
              y: { duration: 5.5 + delay, repeat: Infinity, ease: 'easeInOut', delay },
            },
            whileHover: {
              y: -10,
              rotate: hoverRotate,
              scale: 1.02,
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 32px 56px rgba(0, 0, 0, 0.45)',
            },
          })}
    >
      {children}
    </motion.div>
  );
}

function LiveBadge() {
  return (
    <span className="shrink-0 rounded-full border border-[#4fd1c5]/40 bg-[#4fd1c5]/10 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.14em] text-[#4fd1c5]">
      {CARD_LIVE_BADGE}
    </span>
  );
}

function WindowDots() {
  return (
    <div className="flex gap-1.5">
      <span className="h-2 w-2 rounded-full bg-white/35" />
      <span className="h-2 w-2 rounded-full bg-white/25" />
      <span className="h-2 w-2 rounded-full bg-white/25" />
    </div>
  );
}

function Avatar({ src, alt, size = 'md' }: { src: string; alt: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  return (
    <div
      className={`${dim} relative shrink-0 overflow-hidden rounded-full border-2 border-white/30 bg-white/10`}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 block h-full w-full max-w-none object-cover object-center"
      />
    </div>
  );
}

function TealBar({ pct, className = 'h-1.5' }: { pct: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`overflow-hidden rounded-full bg-white/10 ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: TEAL }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduce ? 0 : 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </div>
  );
}

function CareerCard() {
  return (
    <GlassCard
      className="absolute right-0 top-0 w-[58%] max-w-[296px] p-3.5 sm:p-4"
      rotate={2.5}
      hoverRotate={0}
      zIndex={20}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold leading-tight text-white">
          {CARD_CAREER_PATH_TITLE}
        </p>
        <LiveBadge />
      </div>

      <div className="mb-2.5 rounded-xl border border-white/10 bg-black/25 p-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <LineChart size={11} className="shrink-0 text-[#4fd1c5]/80" />
          <span className="text-[10px] text-white/65">{CARD_CAREER_ANALYSIS}</span>
        </div>
        <TealBar pct={CARD_CAREER_ANALYSIS_PROGRESS} />
      </div>

      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[9px] text-white/70">
          {CARD_PEER_COMPARISONS}
        </span>
        <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[9px] text-white/70">
          {CARD_WORK_PREDICTIONS}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-white/10 pt-2.5">
        <div>
          <p className="mb-0.5 text-[9px] text-white/45">{CARD_CAREER_INSIGHTS}</p>
          <p className="mb-2 text-[9px] leading-snug text-white/60">{CARD_CAREER_STAT}</p>
          <div className="flex items-center justify-between gap-1">
            <div className="flex -space-x-2">
              {LOGIN_AVATARS.insights.map((src, i) => (
                <div key={src} style={{ zIndex: 3 - i }}>
                  <Avatar src={src} alt={`Insight ${i + 1}`} size="sm" />
                </div>
              ))}
            </div>
            <span className="text-[12px] font-bold tabular-nums text-[#4fd1c5]">
              {CARD_CAREER_SCORE}
            </span>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[9px] text-white/45">{CARD_NESTED_SKILL_GAP_TITLE}</p>
          <ul className="space-y-0.5">
            {CARD_SKILL_GAP_BULLETS.map(b => (
              <li key={b} className="flex gap-1 text-[8px] leading-snug text-white/40">
                <span className="text-[#4fd1c5]/50">•</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </GlassCard>
  );
}

function MatchCard() {
  return (
    <GlassCard
      className="absolute left-[26%] top-[28%] w-[94%] max-w-[400px] -translate-x-1/2 grid flex-wrap p-3.5 sm:p-4"
      rotate={-1}
      hoverRotate={0}
      delay={0.5}
      zIndex={30}
    >
      <div className="mb-3 flex items-center justify-between">
        <WindowDots />
        <LiveBadge />
      </div>

      <div className="mb-3 space-y-2">
        <div className="h-2 rounded-full bg-white/10" />
        <div className="h-2 w-[84%] rounded-full bg-white/10" />
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-black/35 p-3 shadow-inner">
        <div className="mb-3 flex items-start gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#4fd1c5]/25"
            style={{ backgroundColor: `${TEAL}18` }}
          >
            <Share2 size={14} style={{ color: TEAL }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[10px] font-medium leading-snug text-white/90">
              {CARD_MATCH_LABEL}
            </p>
            <TealBar pct={52} className="h-1" />
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <div className="flex shrink-0 -space-x-2.5">
            {LOGIN_AVATARS.candidates.map((src, i) => (
              <div key={src} style={{ zIndex: 3 - i }}>
                <Avatar src={src} alt={`Candidate ${i + 1}`} />
              </div>
            ))}
          </div>
          <span className="shrink-0 text-[10px] text-white/55">{CARD_MATCH_WORD}</span>
          <span className="shrink-0 text-[12px] font-bold tabular-nums text-[#4fd1c5]">
            {CARD_MATCH_SCORE}
          </span>
          <div className="min-w-[40px] flex-1">
            <TealBar pct={CARD_MATCH_PROGRESS} className="h-2.5" />
          </div>
        </div>

        <p className="text-justify text-[9px] leading-[1.55] text-white/45">
          {CARD_MATCH_DESCRIPTION}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
          <LineChart size={14} className="text-white/45" />
        </div>
        <div className="h-3 flex-1 rounded-full bg-white/10" />
      </div>
    </GlassCard>
  );
}

function SkillGapCard() {
  return (
    <GlassCard
      className="absolute bottom-[8%] left-[14%] w-[48%] max-w-[228px] p-3.5 sm:p-4"
      rotate={-2}
      hoverRotate={0.5}
      delay={1}
      zIndex={10}
    >
      <p className="mb-3.5 text-[11px] font-semibold text-white">{CARD_SKILL_GAP_TITLE}</p>

      <div className="mb-3.5 flex items-center gap-2.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#4fd1c5]/25"
          style={{ backgroundColor: `${TEAL}18` }}
        >
          <LayoutGrid size={13} style={{ color: TEAL }} />
        </div>
        <TealBar pct={CARD_SKILL_ROW1_PROGRESS} className="h-2" />
      </div>

      <div className="flex items-center gap-2.5">
        <AlertTriangle size={15} className="shrink-0 text-orange-400" />
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full" style={{ width: `${CARD_SKILL_ROW2_TEAL}%`, backgroundColor: TEAL }} />
          <div className="h-full flex-1 bg-orange-500/70" />
        </div>
      </div>
    </GlassCard>
  );
}

function HeroBlock() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="relative z-20 mt-auto pt-6"
      {...(reduce ? {} : { initial: { opacity: 0, y: 16 } })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
    >
      <h2 className="max-w-md font-serif text-[2.1rem] font-bold leading-[1.12] tracking-tight text-white xl:text-[2.65rem]">
        {INTELLIGENCE_HERO_LINE_1}
        <br />
        {INTELLIGENCE_HERO_LINE_2}
      </h2>
      <div className="mt-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#4fd1c5]/80">
        <div className="h-px w-10 bg-[#4fd1c5]/50" />
        {INTELLIGENCE_SUITE_LABEL}
      </div>
    </motion.div>
  );
}

export function AuthIntelligencePanel() {
  return (
    <div className="relative hidden min-h-screen w-1/2 flex-col overflow-hidden bg-[#042f2c] lg:flex">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 65% at 70% 12%, rgba(16,185,129,0.22) 0%, transparent 52%), radial-gradient(ellipse 55% 45% at 8% 88%, rgba(6,78,59,0.25) 0%, transparent 48%), linear-gradient(165deg, #065f46 0%, #042f2c 38%, #031a18 100%)',
        }}
      />
      <div className="pointer-events-none absolute -right-20 top-0 h-[420px] w-[420px] rounded-full bg-emerald-600/15 blur-[100px]" />

      <div className="relative z-10 flex flex-1 flex-col px-8 py-10 xl:px-10 xl:py-12 2xl:px-12">
        <div className="relative min-h-[min(58vh,520px)] flex-1 w-full">
          <CareerCard />
          <MatchCard />
          <SkillGapCard />
        </div>

        <HeroBlock />
      </div>
    </div>
  );
}
