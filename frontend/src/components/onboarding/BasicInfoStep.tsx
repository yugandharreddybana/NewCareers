import { useCallback, useState } from 'react';
import { CAPTCHA_ENABLED, RecaptchaBlock } from '@/components/auth/RecaptchaBlock';
import { CvUploadDropzone } from '@/components/onboarding/CvUploadDropzone';
import { isLikelyValidUrl } from '@/lib/normalizeUrl';

export type BasicInfoValues = {
  fullName: string;
  headline: string;
  experienceYears: string;
  location: string;
  linkedInUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  cvFile: File | null;
};

type LinkField = 'linkedInUrl' | 'portfolioUrl' | 'githubUrl';

type Props = {
  values: BasicInfoValues;
  onChange: (patch: Partial<BasicInfoValues>) => void;
  onSubmit: () => void;
  parsingCv?: boolean;
  parseCaptchaToken?: string | null;
  onParseCaptchaChange?: (token: string | null) => void;
};

function linkLabel(field: LinkField): string {
  if (field === 'linkedInUrl') return 'LinkedIn';
  if (field === 'portfolioUrl') return 'Portfolio website';
  return 'GitHub';
}

export function BasicInfoStep({
  values,
  onChange,
  onSubmit,
  parsingCv = false,
  parseCaptchaToken: _parseCaptchaToken,
  onParseCaptchaChange,
}: Props) {
  const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkField, string>>>({});

  const validateLink = useCallback((field: LinkField, raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return isLikelyValidUrl(trimmed) ? null : `Enter a valid ${linkLabel(field)} URL`;
  }, []);

  const validateAllLinks = useCallback((): boolean => {
    const next: Partial<Record<LinkField, string>> = {};
    let valid = true;
    (['linkedInUrl', 'portfolioUrl', 'githubUrl'] as const).forEach(field => {
      const err = validateLink(field, values[field]);
      if (err) {
        next[field] = err;
        valid = false;
      }
    });
    setLinkErrors(next);
    return valid;
  }, [validateLink, values]);

  const handleLinkBlur = (field: LinkField) => {
    const err = validateLink(field, values[field]);
    setLinkErrors(prev => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsingCv) return;
    if (!validateAllLinks()) return;
    onSubmit();
  };

  const linkInputClass = (field: LinkField) =>
    ['onboarding-input', linkErrors[field] ? 'onboarding-input--error' : ''].filter(Boolean).join(' ');

  return (
    <div className="onboarding-basic-info-step" aria-busy={parsingCv || undefined}>
      <div className="mb-8">
        <h1 className="onboarding-basic-info__title">
          Let&apos;s build your professional profile
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Tell us a bit about yourself to help us find the perfect match.
        </p>
      </div>

      <form
        className="onboarding-form onboarding-basic-info-step__form"
        onSubmit={handleSubmit}
        aria-busy={parsingCv}
      >
        <fieldset className="onboarding-basic-info-step__fieldset" disabled={parsingCv}>
          <div className="onboarding-form-fields">
            <div className="onboarding-field">
              <label htmlFor="fullName">
                Full Name <span className="onboarding-required">*</span>
              </label>
              <input
                className="onboarding-input"
                id="fullName"
                name="fullName"
                placeholder="Jane Doe"
                type="text"
                value={values.fullName}
                required
                onChange={e => onChange({ fullName: e.target.value })}
              />
            </div>

            <div className="onboarding-field">
              <label htmlFor="headline">
                Professional Headline <span className="onboarding-required">*</span>
              </label>
              <input
                className="onboarding-input"
                id="headline"
                name="headline"
                placeholder="e.g. Senior Product Designer"
                type="text"
                value={values.headline}
                required
                onChange={e => onChange({ headline: e.target.value })}
              />
            </div>

            <div className="onboarding-form-grid-2">
              <div className="onboarding-field">
                <label htmlFor="experience">
                  Years of Experience <span className="onboarding-required">*</span>
                </label>
                <div className="relative">
                  <select
                    className="onboarding-select"
                    id="experience"
                    name="experience"
                    required
                    value={values.experienceYears}
                    onChange={e => onChange({ experienceYears: e.target.value })}
                  >
                    <option disabled value="">
                      Select duration
                    </option>
                    <option value="0-2">0 - 2 years</option>
                    <option value="3-5">3 - 5 years</option>
                    <option value="6-10">6 - 10 years</option>
                    <option value="10+">10+ years</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-outline">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div className="onboarding-field">
                <label htmlFor="location">Current Location</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      location_on
                    </span>
                  </div>
                  <input
                    className="onboarding-input onboarding-input--icon-left"
                    id="location"
                    name="location"
                    placeholder="City, Country"
                    type="text"
                    value={values.location}
                    onChange={e => onChange({ location: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="onboarding-form-section">
              <p className="onboarding-form-section__title">Professional links</p>

              <div className="onboarding-form-fields onboarding-form-fields--nested">
                <div className="onboarding-field onboarding-field--muted">
                  <label htmlFor="linkedInUrl">LinkedIn</label>
                  <input
                    className={linkInputClass('linkedInUrl')}
                    id="linkedInUrl"
                    name="linkedInUrl"
                    placeholder="linkedin.com/in/yourname"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={values.linkedInUrl}
                    onChange={e => onChange({ linkedInUrl: e.target.value })}
                    onBlur={() => handleLinkBlur('linkedInUrl')}
                    aria-invalid={Boolean(linkErrors.linkedInUrl)}
                    aria-describedby={linkErrors.linkedInUrl ? 'linkedInUrl-error' : undefined}
                  />
                  {linkErrors.linkedInUrl && (
                    <p id="linkedInUrl-error" className="onboarding-field__error" role="alert">
                      {linkErrors.linkedInUrl}
                    </p>
                  )}
                </div>

                <div className="onboarding-field onboarding-field--muted">
                  <label htmlFor="portfolioUrl">Portfolio website</label>
                  <input
                    className={linkInputClass('portfolioUrl')}
                    id="portfolioUrl"
                    name="portfolioUrl"
                    placeholder="yourdomain.com"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={values.portfolioUrl}
                    onChange={e => onChange({ portfolioUrl: e.target.value })}
                    onBlur={() => handleLinkBlur('portfolioUrl')}
                    aria-invalid={Boolean(linkErrors.portfolioUrl)}
                    aria-describedby={linkErrors.portfolioUrl ? 'portfolioUrl-error' : undefined}
                  />
                  {linkErrors.portfolioUrl && (
                    <p id="portfolioUrl-error" className="onboarding-field__error" role="alert">
                      {linkErrors.portfolioUrl}
                    </p>
                  )}
                </div>

                <div className="onboarding-field onboarding-field--muted">
                  <label htmlFor="githubUrl">GitHub</label>
                  <input
                    className={linkInputClass('githubUrl')}
                    id="githubUrl"
                    name="githubUrl"
                    placeholder="github.com/yourname"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={values.githubUrl}
                    onChange={e => onChange({ githubUrl: e.target.value })}
                    onBlur={() => handleLinkBlur('githubUrl')}
                    aria-invalid={Boolean(linkErrors.githubUrl)}
                    aria-describedby={linkErrors.githubUrl ? 'githubUrl-error' : undefined}
                  />
                  {linkErrors.githubUrl && (
                    <p id="githubUrl-error" className="onboarding-field__error" role="alert">
                      {linkErrors.githubUrl}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <CvUploadDropzone
            file={values.cvFile}
            onFile={file => onChange({ cvFile: file })}
            variant="hero"
            required
            disabled={parsingCv}
          />

          {CAPTCHA_ENABLED && onParseCaptchaChange && (
            <RecaptchaBlock
              onChange={onParseCaptchaChange}
              onExpired={() => onParseCaptchaChange(null)}
              className="flex justify-center py-2"
            />
          )}

          <div className="onboarding-actions">
            <div className="onboarding-trust">
              <div className="onboarding-trust__item">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  lock
                </span>
                <span className="font-label-sm text-label-sm tracking-wider uppercase">
                  Secure SSL
                </span>
              </div>
              <div className="onboarding-trust__divider" aria-hidden="true" />
              <div className="onboarding-trust__item">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  verified_user
                </span>
                <span className="font-label-sm text-label-sm tracking-wider uppercase">
                  Encrypted
                </span>
              </div>
            </div>

            <button className="onboarding-btn-primary onboarding-btn-primary--full" type="submit">
              Continue
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                arrow_forward
              </span>
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
