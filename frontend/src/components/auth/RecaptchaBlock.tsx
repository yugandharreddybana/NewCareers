import { forwardRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { CAPTCHA_ENABLED, RECAPTCHA_SITE_KEY } from '@/lib/env';

type RecaptchaBlockProps = {
  onChange: (token: string | null) => void;
  onExpired?: () => void;
  className?: string;
};

export const RecaptchaBlock = forwardRef<ReCAPTCHA, RecaptchaBlockProps>(
  function RecaptchaBlock({ onChange, onExpired, className }, ref) {
    if (!CAPTCHA_ENABLED) {
      return null;
    }

    return (
      <div className={className ?? 'flex justify-center'}>
        <ReCAPTCHA
          ref={ref}
          sitekey={RECAPTCHA_SITE_KEY}
          onChange={onChange}
          onExpired={() => {
            onChange(null);
            onExpired?.();
          }}
        />
      </div>
    );
  },
);

export { CAPTCHA_ENABLED };
