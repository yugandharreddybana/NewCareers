import { Loader2 } from 'lucide-react';
import { CvUploadDropzone } from '@/components/onboarding/CvUploadDropzone';

export type BasicInfoValues = {
  fullName: string;
  headline: string;
  experienceYears: string;
  location: string;
  cvFile: File | null;
};

type Props = {
  values: BasicInfoValues;
  onChange: (patch: Partial<BasicInfoValues>) => void;
  onSubmit: () => void;
  parsingCv?: boolean;
};

export function BasicInfoStep({ values, onChange, onSubmit, parsingCv = false }: Props) {
  return (
    <>
      <div className="mb-10 mt-4">
        <h1 className="font-headline-xl text-headline-xl text-on-surface mb-2">
          Let&apos;s build your professional profile
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Tell us a bit about yourself to help us find the perfect match.
        </p>
      </div>

      <form
        className="onboarding-form"
        onSubmit={e => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label
              className="block font-label-md text-label-md text-on-surface mb-[8px]"
              htmlFor="fullName"
            >
              Full Name <span className="text-error">*</span>
            </label>
            <input
              className="block w-full p-[12px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow"
              id="fullName"
              name="fullName"
              placeholder="Jane Doe"
              type="text"
              value={values.fullName}
              required
              onChange={e => onChange({ fullName: e.target.value })}
            />
          </div>

          <div>
            <label
              className="block font-label-md text-label-md text-on-surface mb-[8px]"
              htmlFor="headline"
            >
              Professional Headline
            </label>
            <input
              className="block w-full p-[12px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow"
              id="headline"
              name="headline"
              placeholder="e.g. Senior Product Designer"
              type="text"
              value={values.headline}
              onChange={e => onChange({ headline: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                className="block font-label-md text-label-md text-on-surface mb-[8px]"
                htmlFor="experience"
              >
                Years of Experience
              </label>
              <div className="relative">
                <select
                  className="block w-full p-[12px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface font-body-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow"
                  id="experience"
                  name="experience"
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

            <div>
              <label
                className="block font-label-md text-label-md text-on-surface mb-[8px]"
                htmlFor="location"
              >
                Current Location
              </label>
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    location_on
                  </span>
                </div>
                <input
                  className="block w-full pl-10 p-[12px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-shadow"
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
        </div>

        <CvUploadDropzone
          file={values.cvFile}
          onFile={file => onChange({ cvFile: file })}
          variant="hero"
          required
        />

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

          <button
            className="onboarding-btn-primary onboarding-btn-primary--full"
            type="submit"
            disabled={parsingCv}
          >
            {parsingCv ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Reading your CV…
              </>
            ) : (
              <>
                Continue
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
