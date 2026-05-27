import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH = 288;
const VIEWPORT_PAD = 12;

type Props = {
  tip: string;
  label: string;
};

export function SkillHelpTooltip({ tip, label }: Props) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PAD));

    // Sit above the trigger with a small gap
    const top = rect.top - 8;

    setCoords({ top, left });
  }, []);

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;

    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  const bubble =
    open &&
    createPortal(
      <div
        id={tooltipId}
        role="tooltip"
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: TOOLTIP_WIDTH,
          transform: 'translateY(-100%)',
        }}
        className="z-[9999] pointer-events-none rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-3 text-body-sm text-on-surface-variant leading-relaxed shadow-lg"
      >
        {tip}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-secondary hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden>
          help
        </span>
      </button>
      {bubble}
    </>
  );
}

export default SkillHelpTooltip;
