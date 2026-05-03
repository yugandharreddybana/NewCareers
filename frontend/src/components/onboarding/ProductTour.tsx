/**
 * ProductTour — Spotlight-style guided tour
 * - Dims the page with a cutout spotlight over the target element
 * - Tooltip card positioned relative to the spotlight
 * - Animated entry/exit, progress dots, back/next/skip
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

export interface TourStep {
  targetId:   string;
  title:      string;
  body:       string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface Rect {
  top: number; left: number; width: number; height: number;
}

interface ProductTourProps {
  steps:      TourStep[];
  onComplete: () => void;
  onSkip:     () => void;
}

const PAD = 10; // spotlight padding around target
const TIP = 280; // tooltip width

function getTooltipStyle(
  rect: Rect,
  placement: TourStep['placement'] = 'bottom',
): React.CSSProperties {
  const gap = 20;
  const style: React.CSSProperties = { position: 'fixed', width: TIP, zIndex: 10000 };

  if (placement === 'bottom') {
    style.top  = rect.top + rect.height + PAD + gap;
    style.left = Math.max(12, Math.min(rect.left + rect.width / 2 - TIP / 2, window.innerWidth - TIP - 12));
  } else if (placement === 'top') {
    style.bottom = window.innerHeight - (rect.top - PAD - gap);
    style.left   = Math.max(12, Math.min(rect.left + rect.width / 2 - TIP / 2, window.innerWidth - TIP - 12));
  } else if (placement === 'right') {
    style.top  = Math.max(12, rect.top + rect.height / 2 - 80);
    style.left = rect.left + rect.width + PAD + gap;
  } else {
    style.top   = Math.max(12, rect.top + rect.height / 2 - 80);
    style.right = window.innerWidth - (rect.left - PAD - gap);
  }
  return style;
}

export const ProductTour: React.FC<ProductTourProps> = ({ steps, onComplete, onSkip }) => {
  const [current, setCurrent] = useState(0);
  const [rect, setRect]       = useState<Rect | null>(null);

  const step = steps[current];

  const updateRect = useCallback(() => {
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  const measureAndScroll = useCallback(() => {
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateRect();
  }, [step, updateRect]);

  // Initial scroll when step changes
  useEffect(() => {
    measureAndScroll();
  }, [measureAndScroll]);

  // Keep cutout synced during resize and scroll
  useEffect(() => {
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true); // true for capturing phase
    
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  // Prevent user from manually scrolling while tour is active
  useEffect(() => {
    const preventScroll = (e: Event) => e.preventDefault();
    const preventKeyScroll = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'Space', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.code)) {
        e.preventDefault();
      }
    };
    
    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('keydown', preventKeyScroll, { passive: false });
    
    return () => {
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('keydown', preventKeyScroll);
    };
  }, []);

  if (!step) return null;

  const isLast  = current === steps.length - 1;
  const isFirst = current === 0;

  const spotlightStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top:      rect.top  - PAD,
        left:     rect.left - PAD,
        width:    rect.width  + PAD * 2,
        height:   rect.height + PAD * 2,
        borderRadius: 12,
        zIndex: 9999,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        border: '2px solid rgba(99,102,241,0.6)',
      }
    : { display: 'none' };

  const tooltipStyle: React.CSSProperties = rect
    ? getTooltipStyle(rect, step.placement)
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: TIP,
        zIndex: 10000,
      };

  return (
    <>
      {/* Full-page backdrop (click to skip) */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ cursor: 'default' }}
        aria-hidden="true"
      />

      {/* Spotlight cutout */}
      {rect && (
        <div style={spotlightStyle} aria-hidden="true" />
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          style={tooltipStyle}
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label={`Tour step ${current + 1} of ${steps.length}`}
          className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden border border-border"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              {/* Step dots */}
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === current
                        ? 'w-4 h-1.5 bg-brand-500'
                        : i < current
                        ? 'w-1.5 h-1.5 bg-brand-300'
                        : 'w-1.5 h-1.5 bg-slate-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-text-tertiary font-medium">
                {current + 1} / {steps.length}
              </span>
            </div>
            <button
              onClick={onSkip}
              className="p-1 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-surface-raised
                         transition-colors"
              aria-label="Skip tour"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 pb-4">
            <h3 className="font-bold text-[15px] text-text-primary mb-1.5">{step.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{step.body}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-t border-border">
            <button
              onClick={onSkip}
              className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={() => setCurrent(c => c - 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             border border-border text-text-secondary hover:bg-surface-overlay
                             transition-colors"
                >
                  <ArrowLeft size={12} />
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (isLast) onComplete();
                  else setCurrent(c => c + 1);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                           bg-brand-500 text-white hover:bg-brand-600 transition-colors"
              >
                {isLast ? 'Get started' : 'Next'}
                {!isLast && <ArrowRight size={12} />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

// Pre-defined tour steps — target IDs must match elements on the Dashboard page
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    targetId:  'dashboard-search-bar',
    title:     'Search for roles',
    body:      'Start by searching for a job title or company. CareerOps analyses match strength and surfaces the best opportunities for your profile.',
    placement: 'bottom',
  },
  {
    targetId:  'dashboard-skill-actions',
    title:     'Your AI skill toolkit',
    body:      '14 AI skills generate tailored CVs, cover letters, interview prep, and more — all personalised to the specific role you select.',
    placement: 'bottom',
  },
  {
    targetId:  'dashboard-planner-card',
    title:     'Application Planner',
    body:      'CareerOps auto-generates your next actions for every job. Never miss a follow-up or deadline.',
    placement: 'top',
  },
  {
    targetId:  'nav-progress',
    title:     'Track your weekly progress',
    body:      'See your application streaks, response rates, and AI-generated wins and bottlenecks every week.',
    placement: 'right',
  },
];
