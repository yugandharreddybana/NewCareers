import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import '@/styles/not-found.css';

const ILLUSTRATION_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDiiQm7x49vgYYnnrhj_ksJS84PU1qz2-Jg_GmrQgTzLtMH8VCP9fm4bKAYDCoeIOKNF3wIHv52FPHUSuECwO7w2obpg1DQSTmzTkPx8Xjmx6aY0ezEqQ3H-JQqJY1fek553b5pXXvb0MkITcmmzRED-pICCpj0AWufUQd2YGOlnwbYAmJEt-FiysDoTxOCzHLmWxVp9aN5KlkvIDHw7bwegD4rfaObmQ0IROGsS3_F9DvPoSEIngDRXKXGCRW0TBTTWHlOtoB2vox6';

export default function NotFound() {
  const bg404Ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = bg404Ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onMove = (e: MouseEvent) => {
      const moveX = (e.clientX - window.innerWidth / 2) * 0.01;
      const moveY = (e.clientY - window.innerHeight / 2) * 0.01;
      el.style.transform = `translate(${moveX}px, ${moveY}px)`;
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="not-found-page">
      <PageMeta title="Page Not Found | NewCareers" />

      <main className="not-found-canvas flex-1 flex items-center justify-center relative overflow-hidden py-margin-desktop px-margin-mobile">
        <div className="not-found-bg-404" aria-hidden="true">
          <span ref={bg404Ref}>404</span>
        </div>

        <div className="max-w-2xl w-full text-center relative z-10 flex flex-col items-center">
          <div className="not-found-illustration relative w-full max-w-[500px] mb-12">
            <img
              alt="A surreal 3D illustration of a white staircase leading up to a floating glowing doorway in the clouds with the number 404 above it."
              className="w-full h-auto drop-shadow-2xl"
              src={ILLUSTRATION_SRC}
              width={500}
              height={400}
              loading="eager"
              decoding="async"
            />
          </div>

          <div className="space-y-base">
            <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight">
              Oops! This path seems to be off-track.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">
              The page you are looking for might have been moved, renamed, or is temporarily
              unavailable. Let&apos;s get you back to your career momentum.
            </p>
          </div>

          <div className="mt-margin-desktop flex flex-col items-center">
            <Link
              to="/dashboard"
              className="not-found-cta-pulse group relative inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-8 py-3 rounded-lg font-label-md text-label-md font-bold hover:shadow-lg transition-all duration-300 active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                dashboard
              </span>
              Back to Dashboard
            </Link>
          </div>

          <div className="mt-gutter pt-gutter border-t border-outline-variant/30 w-full max-w-xs flex justify-center gap-gutter text-on-surface-variant opacity-60">
            <a
              href="mailto:support@newcareers.ai"
              className="hover:text-primary transition-colors font-label-sm text-label-sm"
            >
              Contact Support
            </a>
            <span className="text-outline-variant" aria-hidden="true">
              •
            </span>
            <a
              href="mailto:support@newcareers.ai?subject=Bug%20report"
              className="hover:text-primary transition-colors font-label-sm text-label-sm"
            >
              Report a Bug
            </a>
          </div>
        </div>
      </main>

      <footer className="w-full py-8 mt-auto bg-surface-container-lowest border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex flex-col sm:flex-row items-center justify-between gap-4 text-on-surface-variant font-body-sm text-body-sm">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-headline-md font-bold text-primary">NewCareers</span>
            <span>© {new Date().getFullYear()} NewCareers AI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-gutter">
            <Link to="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <a href="mailto:support@newcareers.ai" className="hover:text-primary transition-colors">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
