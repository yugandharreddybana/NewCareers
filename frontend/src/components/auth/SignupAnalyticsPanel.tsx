/**
 * Executive analytics panel for the signup page (right split).
 */
import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const TEAL = '#89f5e7';

const FEED_ITEMS = [
  {
    icon: 'trending_up',
    content: (
      <>
        Market demand for <span className="text-[#89f5e7]">VP Engineering</span> in Fintech{' '}
        <span className="text-[#89f5e7]">+12%</span> this month.
      </>
    ),
  },
  {
    icon: 'psychology',
    content: (
      <>
        Emerging skill gap detected:{' '}
        <span className="text-[#89f5e7]">Generative AI Strategy</span> and LLM Ops.
      </>
    ),
  },
  {
    icon: 'verified',
    content: (
      <>
        Your profile matches <span className="text-[#89f5e7]">4 new</span> high-growth leadership
        roles.
      </>
    ),
  },
] as const;

const HEAT_ROWS = [
  [10, 30, 20, 50, 10, 20, 40],
  [20, 40, 60, 80, 50, 30, 10],
  [10, 20, 40, 60, 30, 20, 10],
  [5, 10, 20, 30, 10, 5, 5],
] as const;

type AnalyticsCardProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

function AnalyticsCard({ children, className = '', delay = 0 }: AnalyticsCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={`glass-panel analytics-card flex min-w-0 flex-col rounded-lg p-6 ${className}`}
      {...(reduce ? {} : { initial: { opacity: 0 } })}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function RadarChart() {
  const reduce = useReducedMotion();

  return (
    <div className="radar-stage">
      <motion.svg
        className="radar-chart"
        viewBox="0 0 100 100"
        aria-hidden
        {...(reduce ? {} : { animate: { rotate: [0, 1, 0, -1, 0] } })}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      >
        <polygon className="radar-base" points="50,10 85,30 85,70 50,90 15,70 15,30" />
        <polygon className="radar-base" points="50,25 72,38 72,62 50,75 28,62 28,38" />
        <polygon className="radar-base" points="50,40 60,46 60,54 50,60 40,54 40,46" />
        <line className="radar-axis" x1="50" x2="50" y1="50" y2="10" />
        <line className="radar-axis" x1="50" x2="85" y1="50" y2="30" />
        <line className="radar-axis" x1="50" x2="85" y1="50" y2="70" />
        <line className="radar-axis" x1="50" x2="50" y1="50" y2="90" />
        <line className="radar-axis" x1="50" x2="15" y1="50" y2="70" />
        <line className="radar-axis" x1="50" x2="15" y1="50" y2="30" />
        <motion.polygon
          fill="rgba(137, 245, 231, 0.2)"
          points="50,20 75,35 65,65 50,85 25,65 20,40"
          stroke="rgba(137, 245, 231, 0.8)"
          strokeWidth="1.5"
          {...(reduce ? {} : { initial: { opacity: 0 } })}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
        />
        {[
          [50, 20],
          [75, 35],
          [65, 65],
          [50, 85],
          [25, 65],
          [20, 40],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            fill={TEAL}
            r="2"
            {...(reduce ? {} : { initial: { opacity: 0 } })}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.45 + i * 0.06 }}
          />
        ))}
      </motion.svg>
    </div>
  );
}

export function SignupAnalyticsPanel() {
  const reduce = useReducedMotion();

  return (
    <div className="signup-page__analytics dashboard-bg relative hidden min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain p-8 md:flex lg:p-12">
      <motion.div
        className="signup-analytics-header mb-8 flex items-center justify-between gap-3 border-b border-[#89f5e7]/10 pb-4"
        {...(reduce ? {} : { initial: { opacity: 0 } })}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
      >
        <h2 className="min-w-0 font-headline-lg text-headline-lg tracking-wide text-white/90">
          Executive Analytics
        </h2>
        <div className="live-view-badge shrink-0">
          <span className="material-symbols-outlined text-[16px] text-[#89f5e7]">monitoring</span>
          <span className="font-label-sm text-[#89f5e7] uppercase tracking-wider">Live View</span>
        </div>
      </motion.div>

      <div className="signup-analytics-grid mx-auto grid w-full min-w-0 max-w-[820px] grid-cols-1 gap-6 lg:grid-cols-2">
        <AnalyticsCard delay={0.1}>
          <div className="mb-6 flex min-w-0 items-center gap-3">
            <span className="material-symbols-outlined shrink-0 text-[20px] text-[#89f5e7]">radar</span>
            <h3 className="min-w-0 font-headline-md text-headline-md text-white/90">Skill Gap Analysis</h3>
          </div>
          <RadarChart />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-white/10 pt-4">
            <span className="font-label-sm uppercase tracking-widest text-white/50">
              VP Engineering Profile
            </span>
            <span className="match-badge font-label-md rounded bg-[#89f5e7]/10 px-2 py-1 text-[#89f5e7]">
              82% Match
            </span>
          </div>
        </AnalyticsCard>

        <AnalyticsCard delay={0.2}>
          <div className="mb-6 flex min-w-0 items-center gap-3">
            <span className="material-symbols-outlined shrink-0 text-[20px] text-[#89f5e7]">grid_on</span>
            <h3 className="min-w-0 font-headline-md text-headline-md text-white/90">Market Demand</h3>
          </div>
          <div className="heatmap-stage">
            {HEAT_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="heatmap-row">
                {row.map((opacity, colIndex) => {
                  const isPeak = opacity === 80;
                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`heat-square ${isPeak ? 'heat-square--peak' : ''}`}
                      style={{ opacity: opacity / 100 }}
                      title={isPeak ? 'Peak demand' : undefined}
                    >
                      {isPeak && <span className="heat-square__tip">Peak</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-white/10 pt-4">
            <span className="font-label-sm uppercase tracking-widest text-white/50">Q3 Trajectory</span>
            <span className="font-label-md text-[#89f5e7]">+12% Growth</span>
          </div>
        </AnalyticsCard>

        <AnalyticsCard className="lg:col-span-2" delay={0.3}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="material-symbols-outlined shrink-0 text-[20px] text-[#89f5e7]">timeline</span>
              <h3 className="min-w-0 font-headline-md text-headline-md text-white/90">
                Career Trajectory Prediction
              </h3>
            </div>
            <span className="processing-label font-label-sm uppercase tracking-wider text-white/40">
              Processing
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-4">
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="trajectory-bar h-full rounded-full bg-[#89f5e7]"
                initial={reduce ? { width: '94%' } : { width: '0%' }}
                animate={{ width: '94%' }}
                transition={{ duration: reduce ? 0 : 1.4, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="shrink-0 font-label-md text-[#89f5e7]">94% Confidence</span>
          </div>
        </AnalyticsCard>

        <AnalyticsCard className="gap-4 lg:col-span-2" delay={0.4}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="material-symbols-outlined shrink-0 text-[20px] text-[#89f5e7]">
                sensors
              </span>
              <h3 className="min-w-0 font-headline-md text-headline-md text-white/90">
                Live Intelligence Feed
              </h3>
            </div>
            <span className="font-label-sm uppercase tracking-wider text-[#89f5e7]/60">
              Real-time
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {FEED_ITEMS.map((item, i) => (
              <motion.div
                key={item.icon}
                className="feed-item flex min-w-0 items-start gap-3 rounded border border-white/10 bg-white/5 p-3 sm:items-center"
                {...(reduce ? {} : { initial: { opacity: 0 } })}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              >
                <span className="material-symbols-outlined shrink-0 text-[18px] text-[#89f5e7]">
                  {item.icon}
                </span>
                <p className="min-w-0 flex-1 font-body-md text-body-md text-white/70">{item.content}</p>
              </motion.div>
            ))}
          </div>
        </AnalyticsCard>
      </div>

      <div className="signup-analytics-footer mx-auto mt-8 flex w-full min-w-0 max-w-[820px] flex-col items-start justify-between gap-4 border-t border-[#89f5e7]/10 pt-8 sm:flex-row sm:items-end">
        <h2 className="signup-hero-copy font-headline-xl font-semibold leading-tight tracking-tight text-white/90">
          Your career evaluation
          <br />
          starts here.
        </h2>
        <div className="status-pill flex shrink-0 items-center gap-3 rounded border border-white/10 bg-black/20 px-4 py-2">
          <span className="status-pill__dot h-2 w-2 rounded-full bg-[#89f5e7]" />
          <span className="font-label-sm uppercase tracking-widest text-white/70">
            System Status: Active
          </span>
        </div>
      </div>
    </div>
  );
}
