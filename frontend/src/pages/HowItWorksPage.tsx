import React from 'react';

export default function HowItWorksPage() {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'inherit' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        📖 How CareerOps Works
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2.5rem' }}>
        A complete, transparent explanation of every step — from creating your account to the AI
        matching your ideal job.
      </p>

      {/* ─── 1. Onboarding ──────────────────────────────────────────────── */}
      <Section title="1. Onboarding" icon="🚀">
        <p>
          When you sign up, CareerOps walks you through a 3-step onboarding wizard:
        </p>
        <ol>
          <li>
            <strong>Profile Setup</strong> – Your name, headline, current role, years of experience,
            and optional LinkedIn / GitHub URLs.
          </li>
          <li>
            <strong>Preferences</strong> – Desired roles (e.g. "Backend Engineer"), tech stack,
            work type (Full-time / Contract / Freelance), work setting (Remote / On-site / Hybrid),
            salary range, availability, CV upload, and visa-sponsorship flag.
          </li>
          <li>
            <strong>Job Freshness (maxAgeDays)</strong> – A slider lets you choose how recent the
            jobs must be (1 – 30 days, default 7). Any job posted before your chosen cutoff is
            automatically excluded from your feed.
          </li>
          <li>
            <strong>Minimum Match %</strong> – You can set the lowest AI match score (0–100 %) that
            you want to see. Jobs scoring below this threshold are silently filtered out.
          </li>
        </ol>
        <p>
          Once you click <em>"Find My Jobs"</em> the onboarding preferences are saved to your
          profile and the first job-delivery run is triggered immediately.
        </p>
      </Section>

      {/* ─── 2. Job Sources ─────────────────────────────────────────────── */}
      <Section title="2. Job Sources" icon="🌐">
        <p>
          CareerOps aggregates jobs from <strong>14+ sources simultaneously</strong>, all in Ireland
          (or remote-friendly):
        </p>
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <Th>Source</Th><Th>Type</Th><Th>Coverage</Th>
            </tr>
          </thead>
          <tbody>
            <Tr cells={['IrishJobs.ie', 'Web scraper (Jsoup)', 'Ireland-specific job board']} />
            <Tr cells={['LinkedIn', 'Public listing scraper', 'Global – filtered to Ireland']} />
            <Tr cells={['Indeed', 'RSS feed parser', 'Global – filtered to Ireland']} />
            <Tr cells={['Jobs.ie', 'Web scraper (Jsoup)', 'Ireland-specific job board']} />
            <Tr cells={['JobsIreland.ie', 'Government API (JSON)', 'Irish Government job board']} />
            <Tr cells={['Adzuna', 'REST API', 'Ireland + international (API key required)']} />
            <Tr cells={['Reed.co.uk', 'REST API', 'UK/Ireland (API key required)']} />
            <Tr cells={['EuroJobs', 'Web scraper', 'European tech jobs']} />
            <Tr cells={['Remotive', 'REST API', 'Remote-only roles']} />
            <Tr cells={['We Work Remotely', 'RSS feed', 'Remote-only roles']} />
            <Tr cells={['Jobicy', 'RSS feed', 'Remote tech roles']} />
            <Tr cells={['The Muse', 'REST API', 'Company culture + tech roles']} />
            <Tr cells={['SerpApi (Google Jobs)', 'API', 'Google Jobs aggregator (API key required)']} />
            <Tr cells={['Irish Company Boards', 'Jsoup crawler', 'Careers pages of major Irish employers (e.g. Google, Meta, Accenture, Stripe, HubSpot …)']} />
          </tbody>
        </table>
      </Section>

      {/* ─── 3. Parallel Scraping ───────────────────────────────────────── */}
      <Section title="3. Parallel Scraping Engine" icon="⚡">
        <p>
          All sources are launched <strong>concurrently</strong> via a 16-thread
          <code>ExecutorService</code>. Each source gets up to <strong>30 seconds</strong> to
          respond. If a source times out or throws an error it is logged and skipped — the rest
          continue unaffected.
        </p>
        <p>
          After collection the results are passed through{' '}
          <strong>DeduplicationService</strong> which computes a SHA-256 fingerprint
          (title + company + URL) to remove duplicates before AI scoring.
        </p>
        <p>
          The <strong>maxAgeDays</strong> filter is applied at the scraper level where possible
          (e.g. Adzuna's <code>max_days_old</code> param, LinkedIn's <code>f_TPR</code> param) and
          as a post-filter for sources that don't support it natively.
        </p>
      </Section>

      {/* ─── 4. AI Matching ─────────────────────────────────────────────── */}
      <Section title="4. AI Matching & Scoring" icon="🤖">
        <p>
          Every scraped job is passed through the <strong>AI evaluation pipeline</strong>:
        </p>
        <ol>
          <li>
            <strong>CV Skill Extraction</strong> – <code>CvSkillExtractionService</code> uses
            Claude (Anthropic) to extract a canonical list of skills, years of experience, and
            seniority level from the uploaded CV.
          </li>
          <li>
            <strong>Job Description Enrichment</strong> – <code>JobDescriptionEnrichmentService</code>
            normalises the raw job description, extracting required skills, nice-to-haves, salary
            hints, and visa requirements.
          </li>
          <li>
            <strong>Match Scoring</strong> – <code>JobMatchingService</code> calls the LLM (Claude
            or NVIDIA NIM) with a structured prompt comparing CV skills against job requirements.
            The output is a 0-100 match score plus a gap analysis.
          </li>
          <li>
            <strong>Structured Evaluation</strong> – <code>StructuredJobEvaluationBuilder</code>
            produces a detailed report: match breakdown by category, missing skills, salary
            alignment, culture fit signals, and a final recommendation.
          </li>
        </ol>
        <p>
          Jobs scoring below your <em>minMatchPercent</em> threshold are filtered before storage.
        </p>
      </Section>

      {/* ─── 5. Cron Jobs ───────────────────────────────────────────────── */}
      <Section title="5. Scheduled Cron Jobs" icon="⏰">
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <Th>Job</Th><Th>Schedule</Th><Th>What it does</Th>
            </tr>
          </thead>
          <tbody>
            <Tr cells={['Daily Job Scan', 'Every day at 06:00 UTC', 'Scrapes all sources for each active user and delivers new matching jobs']} />
            <Tr cells={['Weekly Digest Email', 'Every Monday 07:00 UTC', 'Sends a summary email of the top 10 new matches from the past week']} />
            <Tr cells={['Deduplication Cleanup', 'Every day at 02:00 UTC', 'Removes duplicate or expired job listings from the database']} />
            <Tr cells={['Skill Conversation Cleanup', 'Every day at 03:00 UTC', 'Purges AI skill-gap conversation history older than 30 days']} />
            <Tr cells={['Watchlist Checker', 'Every 4 hours', 'Checks if watched companies / roles have posted new jobs']} />
            <Tr cells={['Analytics Rollup', 'Every day at 01:00 UTC', 'Aggregates daily application metrics per user']} />
          </tbody>
        </table>
      </Section>

      {/* ─── 6. AI Skills / Features ────────────────────────────────────── */}
      <Section title="6. AI-Powered Features" icon="✨">
        <table style={tableStyle}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <Th>Feature</Th><Th>AI Model</Th><Th>Description</Th>
            </tr>
          </thead>
          <tbody>
            <Tr cells={['CV Analysis', 'Claude (Anthropic)', 'Extracts skills, seniority, gaps and career trajectory from uploaded CV']} />
            <Tr cells={['Job Match Scoring', 'Claude / NVIDIA NIM', 'Scores each job 0–100 based on CV-to-JD fit']} />
            <Tr cells={['Resume Tailoring', 'Claude', 'Rewrites your CV bullet-points to align with a specific job description']} />
            <Tr cells={['Cover Letter Generator', 'Claude', 'Generates a personalised cover letter for any job']} />
            <Tr cells={['Skill Gap Analysis', 'Claude', 'Identifies which skills you are missing for a target role and suggests learning paths']} />
            <Tr cells={['Interview Coach', 'Claude', 'Generates likely interview questions and model answers based on the JD']} />
            <Tr cells={['Mock Interview', 'Claude', 'Interactive mock interview session with real-time feedback']} />
            <Tr cells={['Networking Outreach', 'Claude', 'Drafts LinkedIn connection messages or cold emails to hiring managers']} />
            <Tr cells={['Application Planner', 'Claude', 'Creates a week-by-week action plan to land a specific role']} />
            <Tr cells={['Career Memory', 'Claude', 'Remembers your preferences and past applications for personalised advice']} />
          </tbody>
        </table>
      </Section>

      {/* ─── 7. Data & Privacy ──────────────────────────────────────────── */}
      <Section title="7. Data & Privacy" icon="🔒">
        <p>
          All data is stored in <strong>Supabase (PostgreSQL)</strong> with row-level security
          enabled. CV files are stored in <strong>Supabase Storage</strong> and are only accessible
          by the owning user. Passwords are never stored — authentication is handled via{' '}
          <strong>JWT + Google OAuth 2.0</strong>. You can delete your account and all associated
          data at any time from the Settings page.
        </p>
      </Section>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#111827' }}>
        {icon} {title}
      </h2>
      <div style={{ lineHeight: 1.7, color: '#374151', fontSize: '0.95rem' }}>{children}</div>
    </section>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.88rem',
};

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb' }}>
      {children}
    </th>
  );
}

function Tr({ cells }: { cells: string[] }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} style={{ padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', verticalAlign: 'top' }}>
          {c}
        </td>
      ))}
    </tr>
  );
}
