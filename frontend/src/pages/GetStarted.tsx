import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import '@/styles/get-started.css';

export default function GetStarted() {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <div className="get-started-page">
      <PageMeta title="Choose your path — NewCareers" />

      <main className="get-started-main">
        <header className="get-started-header">
          <Link className="get-started-logo" to="/">
            NewCareers
          </Link>
          <h1>Choose your path</h1>
          <p>
            Join 1M+ professionals building the future of work. Tell us what brings you to NewCareers today.
          </p>
        </header>

        <div className="get-started-grid">
          <Link className="get-started-card" to="/signup">
            <div className="get-started-card__icon">
              <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                work
              </span>
            </div>
            <h2>I am a Candidate</h2>
            <p>
              Build your profile, discover tailored job opportunities, and track your applications all in one
              place.
            </p>
            <ul>
              <li>
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                AI-powered resume builder
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                Personalized job matches
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                Direct messaging with recruiters
              </li>
            </ul>
            <span className="get-started-btn get-started-btn--primary">Get Started as Candidate</span>
          </Link>

          <Link className="get-started-card" to="/signup">
            <div className="get-started-card__icon">
              <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                business
              </span>
            </div>
            <h2>I am an Employer</h2>
            <p>Post jobs, manage candidates seamlessly, and find the perfect fit for your growing team.</p>
            <ul>
              <li>
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                Access to 1M+ vetted candidates
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                Advanced filtering &amp; matching tools
              </li>
              <li>
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                Collaborative hiring pipelines
              </li>
            </ul>
            <span className="get-started-btn get-started-btn--outline">Get Started as Employer</span>
          </Link>
        </div>

        <p className="get-started-signin">
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </main>

      <footer className="get-started-footer">
        <div>
          <div className="get-started-footer__brand">NewCareers</div>
          <p className="get-started-footer__copy">
            © {new Date().getFullYear()} NewCareers. All rights reserved. Built for the future of work.
          </p>
        </div>
        <nav>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/help">Help Center</Link>
          <Link to="/sales">Contact Sales</Link>
        </nav>
      </footer>
    </div>
  );
}
