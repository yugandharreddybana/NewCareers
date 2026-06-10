import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/authCtx';
import { PlanLimitBanner } from '@/components/PlanLimitBanner';

const BANNER_HEIGHT_VAR = '--status-banner-height';

/** Stacks plan-limit banners and exposes height for fixed chrome offset. */
export function StatusBannerStack() {
  const { user } = useAuth();
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stackRef.current;
    if (!el) {
      document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, '0px');
      return undefined;
    }

    const updateHeight = () => {
      const height = el.offsetHeight;
      document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${height}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, '0px');
    };
  }, [user]);

  if (!user) return null;

  return (
    <>
      <div
        ref={stackRef}
        className="fixed top-0 inset-x-0 z-[100] flex flex-col pointer-events-none [&>*]:pointer-events-auto"
        aria-live="polite"
      >
        <PlanLimitBanner />
      </div>
      <div className="shrink-0" style={{ height: 'var(--status-banner-height, 0px)' }} aria-hidden />
    </>
  );
}
