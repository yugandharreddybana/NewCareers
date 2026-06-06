import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { legalPaths } from '@/lib/brand';
import {
  hasAnalyticsConsent,
  persistAnalyticsChoice,
  shouldShowCookieBanner,
} from '@/lib/cookieConsent';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldShowCookieBanner());
  }, []);

  if (!visible) return null;

  const dismiss = async (accepted: boolean) => {
    await persistAnalyticsChoice(accepted);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed bottom-0 inset-x-0 z-[15000] p-4 sm:p-6 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto pointer-events-auto bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p id="cookie-consent-title" className="font-label-md text-label-md text-on-surface font-semibold">
            Cookies &amp; analytics
          </p>
          <p id="cookie-consent-desc" className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Essential cookies run sign-in and security. Optional analytics help us improve reliability
            {hasAnalyticsConsent() ? ' (currently enabled)' : ''}. See our{' '}
            <Link to={legalPaths.privacy} className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void dismiss(false)}
            className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high transition-colors"
          >
            Reject analytics
          </button>
          <button
            type="button"
            onClick={() => void dismiss(true)}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 transition-opacity"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
