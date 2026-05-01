import React from 'react';
import { skillsApi } from '../../services/skillsApi';
import { ProfileCompletenessAlert } from './ProfileCompletenessAlert';
import { CoverLetterPanel } from './CoverLetterPanel';
import { SalaryNegotiationPanel } from './SalaryNegotiationPanel';
import { CultureFitPanel } from './CultureFitPanel';
import { LinkedInOptimizePanel } from './LinkedInOptimizePanel';
import { SkillsGapPlanPanel } from './SkillsGapPlanPanel';
import type { SkillState } from '../../types/skills';

interface Props {
  skillName: string;
  label: string;
  userJobId: string;
  state: SkillState;
  data: Record<string, unknown> | null;
  error: string | null;
  missingFields: string[];
  isActive: boolean;
  onRun: () => void;
  onDismissAlert: () => void;
}

/**
 * Smart skill panel — routes to a dedicated rich UI for Phase 2 skills,
 * falls back to the generic renderer for all Phase 1 skills.
 */
export function SkillPanel({
  skillName,
  label,
  userJobId,
  state,
  data,
  error,
  missingFields,
  isActive,
  onRun,
  onDismissAlert,
}: Props) {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await skillsApi.downloadSkillPdf(userJobId, skillName);
    } finally {
      setDownloading(false);
    }
  };

  const showLoading = isActive && state === 'loading';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{label}</h3>
        <div className="flex items-center gap-2">
          {state === 'done' && data && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" />
              </svg>
              {downloading ? 'Generating...' : 'PDF'}
            </button>
          )}
          <button
            onClick={onRun}
            disabled={showLoading || state === 'waiting_answer'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {showLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
                Running...
              </>
            ) : state === 'done' ? 'Re-run' : 'Run'}
          </button>
        </div>
      </div>

      {/* Profile incomplete */}
      {isActive && state === 'profile_incomplete' && (
        <ProfileCompletenessAlert
          missingFields={missingFields}
          skillName={skillName}
          onDismiss={onDismissAlert}
        />
      )}

      {/* Waiting for answer */}
      {isActive && state === 'waiting_answer' && (
        <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
          <svg className="animate-pulse h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
          Waiting for your answer in the popup above...
        </div>
      )}

      {/* Error state */}
      {isActive && state === 'error' && error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Result output — Phase 2 skills get dedicated rich panels */}
      {state === 'done' && data && (
        <SkillOutput data={data} skillName={skillName} />
      )}
    </div>
  );
}

export default SkillPanel;

/** Dispatches to a dedicated rich panel for Phase 2 skills; generic renderer otherwise. */
function SkillOutput({
  data,
  skillName,
}: {
  data: Record<string, unknown>;
  skillName: string;
}) {
  // Phase 2 rich panels
  switch (skillName) {
    case 'cover-letter':
      return <CoverLetterPanel data={data as any} />;
    case 'salary-negotiation':
      return <SalaryNegotiationPanel data={data as any} />;
    case 'culture-fit':
      return <CultureFitPanel data={data as any} />;
    case 'linkedin-optimize':
      return <LinkedInOptimizePanel data={data as any} />;
    case 'skills-gap-plan':
      return <SkillsGapPlanPanel data={data as any} />;
    default:
      break;
  }

  // Plain text fallback
  if ('text' in data && typeof data.text === 'string') {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans leading-relaxed">
          {data.text}
        </pre>
      </div>
    );
  }

  // Generic structured JSON renderer (Phase 1 skills)
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {key.replace(/_/g, ' ')}
          </h4>
          <SkillValue value={value} />
        </div>
      ))}
    </div>
  );
}

function SkillValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            <span>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <pre className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 overflow-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-sm text-gray-700 dark:text-gray-300">{String(value)}</span>;
}
