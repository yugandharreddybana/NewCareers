import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { BRAND_NAME, SALES_EMAIL, legalPaths } from '@/lib/brand';

const DASHBOARD_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBVV18H_ENR6BJ-pl4Tdu-mPDbQ2LZwZd5vAcRyNLabB5spviWRoBEmnjqu9wy3jwpUA__PTe_fLA3-1tqpLXp4zLqBxaZibRQ5SaDZUgNxD1S0c0oVliusHrZnEPrUGUY-q7wSTedwabofC9W_sy0O_7kZTkou3GuXJq0y2jZCuoYXkHnRTuKkJoMS5u8TSZ9KdMy635kjQ8ML20uKkHWo5FoTSQdBJgdXjIssCVIBmzcZMqkWcM1fuQjdK1Bq_iENZ3zdE8EDFH6d';

const FEATURES = [
  {
    icon: 'smart_toy',
    title: 'AI Skill Runs',
    description:
      'Instantly map your resume against job descriptions. Identify missing keywords and generate tailored bullet points.',
  },
  {
    icon: 'view_kanban',
    title: 'Kanban Tracker',
    description:
      "Visualize your entire pipeline. Move applications through automated stages from 'Found' to 'Offer Received'.",
  },
  {
    icon: 'description',
    title: 'CV Manager',
    description:
      'Store master achievements and spawn hyper-targeted PDF resumes in seconds with our intelligent templating engine.',
  },
  {
    icon: 'record_voice_over',
    title: 'Interview Prep',
    description:
      'Practice with an AI interviewer trained on your target role. Get real-time feedback on pacing, clarity, and content.',
  },
  {
    icon: 'hub',
    title: 'Networking CRM',
    description:
      'Keep track of coffee chats, referrers, and hiring managers. Never miss a follow-up with intelligent reminders.',
  },
  {
    icon: 'public',
    title: 'Work Permit Intel',
    description:
      'Cross-reference job requirements with global visa policies to filter roles that actively sponsor international talent.',
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      'The AI skill runs helped me tailor every application. I went from scattered spreadsheets to three final-round interviews in six weeks.',
    name: 'Sarah O\'Connor',
    role: 'Product Manager · Dublin',
  },
  {
    quote:
      'Interview prep felt like a real hiring manager. I stopped rambling and started landing callbacks within two weeks.',
    name: 'James Murphy',
    role: 'Software Engineer · Cork',
  },
  {
    quote:
      'Work permit intel alone saved me hours. I only applied to roles that actually sponsor — and got an offer.',
    name: 'Priya Nair',
    role: 'Data Analyst · Galway',
  },
] as const;

const TEAL = '#0d9488';

const Home: React.FC = () => {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <PageMeta title={`${BRAND_NAME} | Land Your Dream Job`} />
      <div className="bg-surface text-on-background font-body-md text-body-md antialiased overflow-x-hidden selection:bg-teal-600/30">
        <MarketingNav />

        {/* Hero Section */}
        <header className="relative min-h-screen flex flex-col md:flex-row pt-[calc(5rem+var(--status-banner-height,0px))] overflow-hidden bg-surface">
          {/* Left Side (Light) */}
          <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 xl:p-24 relative z-10">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#0d9488]/5 to-transparent pointer-events-none" />
            <div className="flex flex-col items-start gap-stack-md max-w-xl w-full">
              <div className="hardware-sticker rounded-full px-4 py-1.5 inline-flex items-center gap-2 animate-slide-up-fade">
                <span className="material-symbols-outlined text-[16px] text-teal-700">bolt</span>
                <span className="font-label-sm text-label-sm text-teal-800 tracking-wide uppercase">
                  Now with NVIDIA Nemotron AI
                </span>
              </div>
              <h1 className="font-headline-xl text-[48px] leading-[1.1] text-on-surface mt-stack-sm tracking-tight animate-slide-up-fade delay-100">
                Land Your Dream Job.
                <br />
                <span className="text-teal-700">Faster / Smarter / With AI.</span>
              </h1>
              <p className="font-body-lg text-[18px] leading-relaxed text-on-surface-variant max-w-[500px] animate-slide-up-fade delay-200">
                {BRAND_NAME} tracks every application, tailors your CV, preps you for interviews, and builds your
                network — all in one master intelligence suite.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-stack-sm animate-slide-up-fade delay-300">
                <Link
                  className="font-label-md text-[14px] text-white px-8 py-4 rounded hover:shadow-[0_0_24px_rgba(13,148,136,0.4)] hover:bg-teal-500 transition-all duration-300 transform hover:-translate-y-0.5 active:scale-95"
                  style={{ backgroundColor: TEAL }}
                  to="/get-started"
                >
                  Start Free — No Card Needed
                </Link>
                <Link
                  className="font-label-md text-[14px] text-on-surface px-8 py-4 rounded bg-white border border-outline-variant hover:bg-surface-container transition-all duration-300 flex items-center gap-2 transform hover:-translate-y-0.5"
                  to="/pricing"
                >
                  <span className="material-symbols-outlined text-[20px]">payments</span>
                  See Plans
                </Link>
              </div>
              <div className="flex items-center gap-3 mt-stack-md text-on-surface-variant opacity-80 animate-slide-up-fade delay-300">
                <div className="flex text-teal-600 text-[14px]">★ ★ ★ ★ ★</div>
                <span className="font-label-sm text-label-sm">Trusted by 12,000+ elite job seekers globally</span>
              </div>
            </div>
          </div>

          {/* Right Side (Dark / Strategic Intelligence) */}
          <div className="w-full md:w-1/2 bg-[#021c19] relative flex items-center justify-center p-8 lg:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-20 radial-mask pointer-events-none" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0d9488]/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-400/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="data-stream left-[20%]" style={{ animationDelay: '0s' }} />
            <div className="data-stream left-[50%]" style={{ animationDelay: '1.5s' }} />
            <div className="data-stream left-[80%]" style={{ animationDelay: '0.7s' }} />

            <div className="relative w-full max-w-2xl perspective-tablet group z-10">
              <div className="absolute -left-12 top-12 glass-card-dark rounded-lg p-4 z-20 animate-slide-up-fade delay-200 transform hover:scale-105 transition-transform duration-300 border-l-2 border-l-teal-500 hidden sm:block">
                <div className="flex items-center gap-2 text-white/90 mb-1">
                  <span className="material-symbols-outlined text-[16px] text-teal-400">query_stats</span>
                  <span className="font-label-sm text-[10px] uppercase tracking-wider">Live Intelligence</span>
                </div>
                <div className="font-label-md text-white">Analyzing Market Trends...</div>
              </div>
              <div className="absolute -right-8 bottom-24 glass-card-dark rounded-lg p-4 z-20 animate-slide-up-fade delay-300 transform hover:scale-105 transition-transform duration-300 border-l-2 border-l-teal-500 hidden sm:block">
                <div className="flex items-center gap-2 text-white/90 mb-1">
                  <span className="material-symbols-outlined text-[16px] text-teal-400">trending_up</span>
                  <span className="font-label-sm text-[10px] uppercase tracking-wider">Network Growth</span>
                </div>
                <div className="font-headline-md text-teal-300">
                  +12.4% <span className="text-white/50 text-sm font-normal">this week</span>
                </div>
              </div>

              <div className="relative rounded-xl bg-white/5 p-2 border border-white/10 glass-card-dark overflow-hidden glow-hover transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#0d9488]/10 to-transparent opacity-50 z-10 pointer-events-none" />
                <img
                  className="w-full h-auto object-cover rounded-lg border border-white/5 opacity-90 group-hover:opacity-100 transition-opacity relative z-0"
                  alt="A sophisticated career management dashboard with dark glassmorphism panels, data visualizations, and an application kanban board."
                  src={DASHBOARD_IMAGE}
                />
              </div>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section
          className="py-24 px-margin-mobile md:px-margin bg-surface-container-lowest border-y border-outline-variant/30 relative z-10 overflow-hidden"
          id="features"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#0d9488]/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="max-w-container-max mx-auto relative z-10">
            <div className="text-center mb-16">
              <h2 className="font-headline-xl text-headline-xl text-on-surface mb-stack-sm tracking-tight">
                The Elite Career Operating System
              </h2>
              <p className="font-body-lg text-[18px] text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
                Stop managing spreadsheets. Let our intelligent pipeline handle the heavy lifting while you focus on the
                interview.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="glass-card-light rounded-xl p-8 flex flex-col gap-5 group hover:-translate-y-1 hover:shadow-2xl hover:border-[#0d9488]/30 transition-all duration-500 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0d9488]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center border border-teal-100 group-hover:border-teal-300 transition-colors relative z-10">
                    <span className="material-symbols-outlined text-[24px] font-light" style={{ color: TEAL }}>
                      {feature.icon}
                    </span>
                  </div>
                  <h3 className="font-headline-md text-[20px] text-on-surface font-semibold tracking-tight relative z-10">
                    {feature.title}
                  </h3>
                  <p className="font-body-md text-on-surface-variant leading-relaxed relative z-10">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 px-margin-mobile md:px-margin bg-surface border-b border-outline-variant/30">
          <div className="max-w-container-max mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-headline-xl text-headline-xl text-on-surface mb-stack-sm tracking-tight">
                Trusted by job seekers
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
                Real stories from individuals using {BRAND_NAME} to run a smarter search.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {TESTIMONIALS.map((item) => (
                <article
                  key={item.name}
                  className="glass-card-light rounded-xl p-8 flex flex-col gap-stack-md h-full"
                >
                  <div className="flex text-teal-600 text-sm">★ ★ ★ ★ ★</div>
                  <p className="font-body-md text-on-surface-variant leading-relaxed flex-grow">&ldquo;{item.quote}&rdquo;</p>
                  <div>
                    <p className="font-label-md text-label-md text-on-surface font-semibold">{item.name}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{item.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full py-16 px-margin-mobile md:px-margin border-t border-outline-variant/30 bg-surface">
          <div className="max-w-container-max mx-auto grid grid-cols-2 md:grid-cols-4 gap-gutter text-center md:text-left">
            <div className="col-span-2 md:col-span-1 flex flex-col items-center md:items-start gap-stack-sm">
              <div className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2 tracking-tight">
                <span className="material-symbols-outlined" style={{ color: TEAL }}>
                  rocket_launch
                </span>
                {BRAND_NAME}
              </div>
              <p className="font-body-md text-[13px] text-on-surface-variant mt-2 leading-relaxed">
                © {new Date().getFullYear()} {BRAND_NAME} Intelligence.
                <br />
                All rights reserved.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="font-label-md text-label-md text-on-surface font-bold tracking-wide uppercase text-[11px]">
                Product
              </h4>
              <a
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                href="#features"
                onClick={(e) => handleAnchorClick(e, 'features')}
              >
                Features
              </a>
              <Link
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                to="/pricing"
              >
                Pricing
              </Link>
              <Link
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                to="/login"
              >
                Login
              </Link>
              <a
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                href="#"
              >
                Changelog
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="font-label-md text-label-md text-on-surface font-bold tracking-wide uppercase text-[11px]">
                Company
              </h4>
              <a
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                href="#features"
                onClick={(e) => handleAnchorClick(e, 'features')}
              >
                About
              </a>
              <a
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                href="#"
              >
                Blog
              </a>
              <a
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                href="#"
              >
                Careers
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <h4 className="font-label-md text-label-md text-on-surface font-bold tracking-wide uppercase text-[11px]">
                Legal
              </h4>
              <Link
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                to={legalPaths.privacy}
              >
                Privacy
              </Link>
              <Link
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                to={legalPaths.terms}
              >
                Terms
              </Link>
              <a
                className="font-body-md text-[14px] text-on-surface-variant hover:text-[#0d9488] transition-colors duration-200"
                href={`mailto:${SALES_EMAIL}`}
              >
                Connect
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Home;
