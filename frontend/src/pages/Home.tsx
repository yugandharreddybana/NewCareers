import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';

interface CounterProps {
  target: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

const AnimatedCounter: React.FC<CounterProps> = ({ target, suffix = '', decimals = 0, duration = 2000 }) => {
  const [value, setValue] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const currentRef = elementRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          let startTime: number | null = null;
          const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const current = progress * target;
            setValue(current);
            if (progress < 1) {
              window.requestAnimationFrame(animate);
            }
          };
          window.requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [target, duration]);

  // Handle format representation for M+ or k+ metrics in screen
  let displayValue = value;
  if (suffix === 'k+') displayValue = value / 1000;
  if (suffix === 'M+') displayValue = value / 1000000;

  return (
    <div ref={elementRef} className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-primary font-bold mb-2">
      {displayValue.toFixed(decimals)}
      {suffix}
    </div>
  );
};

const Home: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [parallaxStyle, setParallaxStyle] = useState<React.CSSProperties>({});

  // Parallax Effect for Background Shapes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const depth = 0.1;
      const moveX = (e.clientX - window.innerWidth / 2) * depth;
      const moveY = (e.clientY - window.innerHeight / 2) * depth;

      setParallaxStyle({
        transform: `translate(${33.33 + moveX / 10}%, ${-25 + moveY / 10}%)`
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Entrance Animations using IntersectionObserver
  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const elements = document.querySelectorAll('.fade-in-up');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  // Handlers for smooth anchor scrolling
  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const integrations = [
    'AcmeCorp',
    'GlobalTech',
    'Innovate.io',
    'Stellar Dynamics',
    'Nexus Systems',
    'AcmeCorp',
    'GlobalTech',
    'Innovate.io',
    'Stellar Dynamics',
    'Nexus Systems'
  ];

  return (
    <>
      <PageMeta title="NewCareers | Your Career Evolution Starts Here" />
      <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary-container selection:text-on-primary-container antialiased overflow-x-hidden">
        
        {/* TopNavBar */}
        <nav className="bg-surface-container-lowest border-b border-outline-variant shadow-sm sticky top-0 z-50">
          <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto h-20">
            {/* Brand logo */}
            <Link className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-2 group" to="/">
              <span className="material-symbols-outlined transition-transform group-hover:rotate-12" style={{ fontVariationSettings: "'FILL' 1" }}>
                work
              </span>
              NewCareers
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              <a
                className="font-body-md text-body-md text-secondary font-medium hover:text-primary transition-colors duration-200"
                href="#jobs"
                onClick={(e) => handleAnchorClick(e, 'jobs')}
              >
                Find Jobs
              </a>
              <a
                className="font-body-md text-body-md text-secondary font-medium hover:text-primary transition-colors duration-200"
                href="#employers"
                onClick={(e) => handleAnchorClick(e, 'employers')}
              >
                For Employers
              </a>
              <a
                className="font-body-md text-body-md text-secondary font-medium hover:text-primary transition-colors duration-200"
                href="#tips"
                onClick={(e) => handleAnchorClick(e, 'tips')}
              >
                Career Tips
              </a>
              <a
                className="font-body-md text-body-md text-secondary font-medium hover:text-primary transition-colors duration-200"
                href="#about"
                onClick={(e) => handleAnchorClick(e, 'about')}
              >
                About Us
              </a>
            </div>

            {/* Top Bar Actions */}
            <div className="flex items-center gap-4">
              <Link
                className="hidden md:inline-flex font-label-md text-label-md font-medium text-secondary hover:text-primary transition-colors"
                to="/login"
              >
                Sign In
              </Link>
              <Link
                className="inline-flex items-center justify-center px-5 py-2.5 bg-primary text-on-primary font-label-md text-label-md font-medium rounded-lg btn-transition shimmer-btn shadow-sm"
                to="/get-started"
              >
                Get Started
              </Link>
              
              {/* Mobile Menu Toggle Button */}
              <button
                className="md:hidden text-on-surface p-2 rounded-lg hover:bg-surface-container-low transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
              >
                <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Dropdown Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-outline-variant bg-surface-container-lowest py-4 px-6 space-y-4 shadow-lg animate-enter">
              <nav className="flex flex-col gap-4 text-base font-medium text-secondary">
                <a
                  className="hover:text-primary transition-colors"
                  href="#jobs"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleAnchorClick(e, 'jobs');
                  }}
                >
                  Find Jobs
                </a>
                <a
                  className="hover:text-primary transition-colors"
                  href="#employers"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleAnchorClick(e, 'employers');
                  }}
                >
                  For Employers
                </a>
                <a
                  className="hover:text-primary transition-colors"
                  href="#tips"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleAnchorClick(e, 'tips');
                  }}
                >
                  Career Tips
                </a>
                <a
                  className="hover:text-primary transition-colors"
                  href="#about"
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleAnchorClick(e, 'about');
                  }}
                >
                  About Us
                </a>
              </nav>
              <hr className="border-outline-variant" />
              <div className="flex flex-col gap-3">
                <Link
                  className="w-full text-center py-2.5 rounded-lg border border-outline text-secondary font-medium hover:bg-surface-container-low transition-colors"
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  className="w-full text-center py-2.5 bg-primary text-on-primary font-semibold rounded-lg btn-transition shimmer-btn shadow-sm"
                  to="/get-started"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>
          )}
        </nav>

        {/* Main Content Area */}
        <main>
          {/* Hero Section */}
          <section className="relative pt-24 pb-32 px-margin-mobile md:px-margin-desktop overflow-hidden">
            {/* Decorative Parallax Background Element */}
            <div
              className="parallax-bg absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-gradient-to-bl from-primary-container/20 to-transparent rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/4 transition-transform duration-100 ease-out"
              style={parallaxStyle}
            />
            
            <div className="max-w-container-max mx-auto grid md:grid-cols-2 gap-12 items-center">
              {/* Left Column Content */}
              <div className="flex flex-col gap-8 z-10 fade-in-up visible">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-container/50 text-on-secondary-container font-label-sm text-label-sm w-fit border border-secondary-fixed">
                  <span className="material-symbols-outlined text-[16px] animate-pulse">bolt</span>
                  <span>The new standard for hiring</span>
                </div>
                
                <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
                  Your Career Evolution <br />
                  <span className="text-primary relative inline-block">
                    Starts Here
                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary-container opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10">
                      <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                    </svg>
                  </span>
                </h1>
                
                <p className="font-body-lg text-body-lg text-secondary max-w-xl">
                  Connect with top employers or find your next great hire on a platform designed for clarity,
                  speed, and precision. We bring authority to modern recruitment.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <Link
                    className="inline-flex items-center justify-center px-8 py-3.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg btn-transition shimmer-btn shadow-sm"
                    to="/get-started"
                  >
                    Get Started
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center px-8 py-3.5 bg-transparent border border-outline text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container-low btn-transition"
                    to="/employers"
                  >
                    For Employers
                  </Link>
                </div>
                
                {/* User trust metrics overlay */}
                <div className="flex items-center gap-4 mt-4 pt-6 border-t border-outline-variant/50">
                  <div className="flex -space-x-3">
                    <img
                      alt="User Candidate"
                      className="w-10 h-10 rounded-full border-2 border-surface-container-lowest object-cover hover:z-10 hover:scale-110 transition-transform"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCm922bLggS-1iBZJQpQuXCdyCkpkuAq7Gx0k7-V12DGs4HG7hPeTGObKzGEmk9PSwLzGSuOmlFuASN8LROOJhw-aZ7dQ82T-DU0ObxwMIQl0S2hMPhrjXqdSQfFxjZSgxLtz_MiHC5TwKRn0gD8r7YzDCSVhUNUPO8LjpDwBU5DV_iv5pDKHmCiX_9BuNsANKQwewgDOH3MTPSVp_ZpFJ2UzaQNvoiJdjsrKxCoeWqrBg6SlWTEPzHvaGL68oO_w5fEYPNZSDFSfZY"
                    />
                    <img
                      alt="User Candidate"
                      className="w-10 h-10 rounded-full border-2 border-surface-container-lowest object-cover hover:z-10 hover:scale-110 transition-transform"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwB7H3o_SSP4HCEzp6KQW8jsVz2TxrHXX11fTI069Vjt1zYpZYxHYtfLf6319ywmH6WnRFq77nncREMeIa40gELCNei-rL2Iv_5SxpV81Lh5fBajM6m_PNeCxLyRmKvxArFQLDfWsWN2f9x1-rqRRXod9oYSO5E3m_eAHZSBtgeZVOcAQfsXhLtSiP95_XEY5lWzLehFYscWKYEghFXDhXiXC9gjlXoj7Uwqulcw4fmP9EgdLMJttTYd9_uf1RYEidSdRsbUGA_aTo"
                    />
                    <img
                      alt="User Candidate"
                      className="w-10 h-10 rounded-full border-2 border-surface-container-lowest object-cover hover:z-10 hover:scale-110 transition-transform"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuC0sAAKekXe5O-AyIE13iRSqWSMqQA0Wq3aLmMVEBJB0Vyh8R9pXOQuttTBdOnpg_MX6TylG1b6THtx5kQk75Az-pYfGrvDJ5h0HCmd8xNICt3OZQz29GYMnFmhYflgsihrSBE6Flqj2DMH3RZAB9KXk2HwyN2aD8jr-zQMKZsYV9Yh3ZbPMwP3BHZmI4TTGkv-mBbYUbtKTW_EStg7RaixML6XSIvE1sswB2niaxbACNfyWqeL18ySJGpSSY842vcX1s59rTY7fgXH"
                    />
                  </div>
                  <div className="font-body-sm text-body-sm text-secondary">
                    <span className="font-semibold text-on-surface">1M+</span> candidates already joined
                  </div>
                </div>
              </div>

              {/* Right Column Interactive Platform Mockup */}
              <div className="relative z-10 hidden md:block">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent rounded-2xl transform rotate-3 scale-105 -z-10" />
                <div className="animate-float">
                  <img
                    alt="NewCareers Platform Preview"
                    className="w-full h-auto rounded-2xl shadow-xl border border-outline-variant/50 object-cover aspect-[4/3]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBG9mmx62f0LXEWlhVIiOgelFGK5y1ePrwaACy1x1YmMNlgOyO9lT6qHAax650yWFiuHBzfXRZeryI5DNtKiK4SCsn8d6kboxJU5oII3RDhm4O9dK_TEvTS74ShHQXooKXefp3sqOYlCGqqPunzh27P5Ko1ZqET6j4rhQlPRHF46BegoZWNQVdMAoBL-Lbe0X89EApiux-BEGoeiKLDp3JhKvGdmGdnYLJvFUqfqxwJdAtfRjGhHmfaB8IAsuH1Z1-RmN19agpD0jnF"
                  />
                  {/* Floating Action Glassmorphic Card */}
                  <div className="absolute -bottom-8 -left-8 glass-card p-4 rounded-xl flex items-center gap-4 animate-float" style={{ animationDelay: '-3s' }}>
                    <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                      <span className="material-symbols-outlined">verified</span>
                    </div>
                    <div>
                      <div className="font-label-md text-label-md font-semibold text-on-surface">Offer Accepted</div>
                      <div className="font-body-sm text-body-sm text-secondary">Just now • Product Designer</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Trusted By Infinite Marquee Section */}
          <section className="py-12 border-y border-outline-variant/50 bg-surface-container-lowest overflow-hidden">
            <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-6 text-center fade-in-up">
              <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest">
                Trusted by innovative teams worldwide
              </p>
            </div>
            
            <div className="marquee-container fade-in-up">
              <div className="marquee-content inline-flex items-center gap-16 md:gap-24 px-8">
                {integrations.map((name, index) => (
                  <div
                    key={index}
                    className="font-headline-sm text-headline-sm text-on-surface-variant font-bold opacity-60 hover:text-primary hover:opacity-100 transition-all duration-200 cursor-default"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bento Grid: Core Product Features */}
          <section className="py-24 px-margin-mobile md:px-margin-desktop bg-surface" id="jobs">
            <div className="max-w-container-max mx-auto">
              <div className="mb-16 md:w-2/3 fade-in-up">
                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Empowering your next move.</h2>
                <p className="font-body-lg text-body-lg text-secondary">
                  Tools designed to cut through the noise and land you exactly where you belong.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]">
                {/* Bento Box 1: Large Card */}
                <div className="md:col-span-2 bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 flex flex-col justify-between group hover-lift soft-shadow overflow-hidden relative fade-in-up">
                  <div className="z-10">
                    <div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed mb-6 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        auto_awesome
                      </span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">AI-Powered Matching</h3>
                    <p className="font-body-md text-body-md text-secondary max-w-md">
                      Our algorithm reads between the lines of your resume to surface roles that fit your true
                      potential, not just your keywords.
                    </p>
                  </div>
                  <div className="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4 w-64 h-64 bg-secondary-container rounded-full opacity-20 blur-2xl group-hover:bg-primary-container transition-colors duration-500" />
                </div>

                {/* Bento Box 2 */}
                <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 flex flex-col justify-between group hover-lift soft-shadow fade-in-up" style={{ transitionDelay: '100ms' }}>
                  <div>
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface mb-6 group-hover:bg-primary-fixed transition-colors group-hover:scale-110">
                      <span className="material-symbols-outlined">document_scanner</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Resume Builder</h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Craft a structured, ATS-friendly profile in minutes using our guided templates.
                    </p>
                  </div>
                </div>

                {/* Bento Box 3 */}
                <div className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/60 flex flex-col justify-between group hover-lift soft-shadow fade-in-up" style={{ transitionDelay: '200ms' }}>
                  <div>
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface mb-6 group-hover:bg-primary-fixed transition-colors group-hover:scale-110">
                      <span className="material-symbols-outlined">track_changes</span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Application Tracking</h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Never wonder where you stand. Real-time updates from 'Applied' to 'Offer'.
                    </p>
                  </div>
                </div>

                {/* Bento Box 4: Wide Highlight Card */}
                <div className="md:col-span-2 bg-primary text-on-primary rounded-2xl p-8 border border-primary flex flex-col sm:flex-row items-center justify-between overflow-hidden relative soft-shadow hover:scale-[1.01] transition-transform fade-in-up" style={{ transitionDelay: '300ms' }}>
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)',
                      backgroundSize: '24px 24px'
                    }}
                  />
                  <div className="z-10 relative mb-6 sm:mb-0">
                    <h3 className="font-headline-md text-headline-md mb-2">Ready to stand out?</h3>
                    <p className="font-body-md text-body-md text-primary-fixed-dim">
                      Join thousands of professionals finding their ideal roles daily.
                    </p>
                  </div>
                  <Link
                    className="z-10 whitespace-nowrap px-6 py-3 bg-surface-container-lowest text-primary font-label-md text-label-md rounded-lg btn-transition hover:bg-surface-container-low shadow-lg active:shadow-sm"
                    to="/signup"
                  >
                    Build Profile
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Real-time Interactive Stats Counters */}
          <section className="py-16 border-y border-outline-variant/50 bg-surface-container-lowest" id="employers">
            <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-outline-variant/30 text-center">
                <div className="px-4 fade-in-up">
                  <AnimatedCounter target={50000} suffix="k+" />
                  <div className="font-label-md text-label-md text-secondary uppercase tracking-wide">Jobs Posted</div>
                </div>
                
                <div className="px-4 fade-in-up" style={{ transitionDelay: '100ms' }}>
                  <AnimatedCounter target={1000000} suffix="M+" />
                  <div className="font-label-md text-label-md text-secondary uppercase tracking-wide">Candidates</div>
                </div>
                
                <div className="px-4 fade-in-up" style={{ transitionDelay: '200ms' }}>
                  <AnimatedCounter target={98} suffix="%" />
                  <div className="font-label-md text-label-md text-secondary uppercase tracking-wide">Match Rate</div>
                </div>
                
                <div className="px-4 fade-in-up" style={{ transitionDelay: '300ms' }}>
                  <AnimatedCounter target={4.9} decimals={1} suffix="/5" />
                  <div className="font-label-md text-label-md text-secondary uppercase tracking-wide">Platform Rating</div>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive How It Works Section */}
          <section className="py-24 px-margin-mobile md:px-margin-desktop bg-surface" id="tips">
            <div className="max-w-container-max mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-20 fade-in-up">
                <span className="text-primary text-xs font-bold tracking-widest uppercase block mb-3">
                  Simple Three-Step Path
                </span>
                <h2 className="text-3xl sm:text-5xl font-display font-extrabold tracking-tight text-on-surface mb-6">
                  Your Path to Career Growth
                </h2>
                <p className="text-secondary text-base sm:text-lg font-light leading-relaxed">
                  We've compressed the friction of job discovery and fit analysis into a seamless loop.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Step 1 */}
                <div className="p-6 sm:p-8 bg-surface-container-lowest border border-outline-variant rounded-2xl space-y-4 hover:border-primary transition-colors hover-lift soft-shadow fade-in-up">
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary font-bold font-mono">
                    01
                  </div>
                  <h4 className="text-lg font-bold text-on-surface">Construct Your Rich Profile</h4>
                  <p className="text-secondary text-sm leading-relaxed font-light">
                    Input your detailed skills, location preferences, salary metrics, and working constraints. This data constructs a structured cryptographic profile hash to feed the AI fit engines.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-6 sm:p-8 bg-surface-container-lowest border border-outline-variant rounded-2xl space-y-4 hover:border-primary transition-colors hover-lift soft-shadow fade-in-up" style={{ transitionDelay: '100ms' }}>
                  <div className="w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center text-primary font-bold font-mono">
                    02
                  </div>
                  <h4 className="text-lg font-bold text-on-surface">Trigger Parallel Job Scrapes</h4>
                  <p className="text-secondary text-sm leading-relaxed font-light">
                    Our multithreaded spring pipeline initiates scans across international databases, fetching fresh opportunities in seconds and skipping blank postings automatically.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-6 sm:p-8 bg-surface-container-lowest border border-outline-variant rounded-2xl space-y-4 hover:border-primary transition-colors hover-lift soft-shadow fade-in-up" style={{ transitionDelay: '200ms' }}>
                  <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary font-bold font-mono">
                    03
                  </div>
                  <h4 className="text-lg font-bold text-on-surface">Track Fit & Organize Cards</h4>
                  <p className="text-secondary text-sm leading-relaxed font-light">
                    Inspect NVIDIA AI insights dynamically (loaded from persistent database cache) and track your status flow in the visual Kanban board. Repeat the process to optimize placement results.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Final Call to Action */}
          <section className="py-32 px-margin-mobile md:px-margin-desktop bg-surface text-center" id="about">
            <div className="max-w-3xl mx-auto flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center mb-8 shadow-sm fade-in-up">
                <span className="material-symbols-outlined text-[32px] animate-bounce">rocket_launch</span>
              </div>
              
              <h2 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-6 fade-in-up">
                Ready to take the next step?
              </h2>
              
              <p className="font-body-lg text-body-lg text-secondary mb-10 max-w-xl fade-in-up">
                Whether you're looking to advance your career or build a world-class team, NewCareers provides the
                clarity and tools you need to succeed.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center fade-in-up">
                <Link
                  className="px-8 py-4 bg-primary text-on-primary font-label-md text-label-md rounded-lg btn-transition shimmer-btn shadow-sm w-full sm:w-auto text-center"
                  to="/signup"
                >
                  Create Free Account
                </Link>
                <a
                  className="px-8 py-4 bg-transparent border border-outline text-on-surface font-label-md text-label-md rounded-lg btn-transition hover:bg-surface-container-low w-full sm:w-auto text-center"
                  href="mailto:sales@newcareers.ai"
                >
                  Contact Sales
                </a>
              </div>
            </div>
          </section>
        </main>

        {/* Global Footer */}
        <footer className="bg-surface-container-high border-t border-outline-variant">
          <div className="w-full py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-gutter">
            <div className="flex flex-col items-center md:items-start gap-4">
              <Link className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2" to="/">
                <span className="material-symbols-outlined">work</span>
                NewCareers
              </Link>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                © {new Date().getFullYear()} NewCareers. All rights reserved. Built for the future of work.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6">
              <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary underline transition-all" to="/privacy">
                Privacy Policy
              </Link>
              <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary underline transition-all" to="/terms">
                Terms of Service
              </Link>
              <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary underline transition-all" to="/help">
                Help Center
              </Link>
              <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary underline transition-all" href="mailto:sales@newcareers.ai">
                Contact Sales
              </a>
              <Link className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary underline transition-all" to="/accessibility">
                Accessibility
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

export default Home;
