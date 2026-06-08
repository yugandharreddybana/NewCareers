import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { PlanLimitBanner } from '@/components/PlanLimitBanner';
import { TrialBanner } from '@/components/TrialBanner';

const BANNER_HEIGHT_VAR = '--status-banner-height';

/**
 * Stacks plan-limit and trial banners vertically (BILL-052) and shows trial globally (BILL-053).
 */
export function StatusBannerStack() {
  const { user } = useAuth();
  const { isTrialing, isLoading } = useSubscription();
  const stackRef = useRef<HTMLDivElement>(null);

  const showTrial = Boolean(user && !isLoading && isTrialing);

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
  }, [user, showTrial]);

  if (!user) return null;

  return (
    <>
      <div
        ref={stackRef}
        className="fixed top-0 inset-x-0 z-[100] flex flex-col pointer-events-none [&>*]:pointer-events-auto"
        aria-live="polite"
      >
        <PlanLimitBanner />
        {showTrial ? <TrialBanner /> : null}
      </div>
      <div className="shrink-0" style={{ height: 'var(--status-banner-height, 0px)' }} aria-hidden />
    </>
  );
}
