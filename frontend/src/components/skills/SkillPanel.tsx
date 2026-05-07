import React from 'react';
import { CircleAlert, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { skillsApi } from '../../services/skillsApi';
import { ProfileCompletenessAlert } from './ProfileCompletenessAlert';
import { CoverLetterPanel } from './CoverLetterPanel';
import { SalaryNegotiationPanel } from './SalaryNegotiationPanel';
import { CultureFitPanel } from './CultureFitPanel';
import { LinkedInOptimizePanel } from './LinkedInOptimizePanel';
import { SkillsGapPlanPanel } from './SkillsGapPlanPanel';
import type { SkillState } from '../../types/skills';

interface Props {
  skillName?: string;
  label?: string;
  title?: string;
  userJobId?: string;
  state?: SkillState;
  data?: Record<string, unknown> | null;
  error?: string | null;
  missingFields?: string[];
  isActive?: boolean;
  open?: boolean;
  children?: React.ReactNode;
  onRun?: () => void;
  onDismissAlert?: () => void;
  skillId?: string;
  icon?: string;
  onClose?: () => void;
}

type SkillData = Record<string, unknown>;
type CoverLetterOutput = React.ComponentProps<typeof CoverLetterPanel>['data'];
type SalaryNegotiationOutput = React.ComponentProps<typeof SalaryNegotiationPanel>['data'];
type CultureFitOutput = React.ComponentProps<typeof CultureFitPanel>['data'];
type LinkedInOptimizeOutput = React.ComponentProps<typeof LinkedInOptimizePanel>['data'];
type SkillsGapOutput = React.ComponentProps<typeof SkillsGapPlanPanel>['data'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value);
}

function isCoverLetterOutput(data: unknown): data is CoverLetterOutput {
  return isObject(data)
    && typeof data.letter === 'string'
    && isOptionalString(data.toneIndicator)
    && isOptionalStringArray(data.personalisationHighlights)
    && isOptionalNumber(data.wordCount);
}

function isSalaryBand(value: unknown): value is SalaryNegotiationOutput['salaryBand'] {
  return isObject(value)
    && isFiniteNumber(value.min)
    && isFiniteNumber(value.mid)
    && isFiniteNumber(value.max)
    && isOptionalString(value.currency);
}

function isSalaryNegotiationOutput(data: unknown): data is SalaryNegotiationOutput {
  return isObject(data)
    && isSalaryBand(data.salaryBand)
    && isFiniteNumber(data.openingAsk)
    && isFiniteNumber(data.targetFigure)
    && isFiniteNumber(data.walkAwayFloor)
    && isOptionalStringArray(data.counterofferResponses)
    && isOptionalStringArray(data.negotiationPhrases)
    && isOptionalString(data.marketInsights);
}

function isCultureDimension(value: unknown): value is NonNullable<CultureFitOutput['dimensions']>[number] {
  return isObject(value)
    && typeof value.name === 'string'
    && isFiniteNumber(value.score)
    && isOptionalString(value.insight);
}

function isCultureFitOutput(data: unknown): data is CultureFitOutput {
  return isObject(data)
    && isFiniteNumber(data.overallScore)
    && (data.dimensions === undefined || (Array.isArray(data.dimensions) && data.dimensions.every(isCultureDimension)))
    && isOptionalString(data.compatibilityParagraph)
    && isOptionalStringArray(data.redFlags)
    && isOptionalStringArray(data.greenFlags);
}

function isHeadlineSection(value: unknown): value is NonNullable<LinkedInOptimizeOutput['headline']> {
  return isObject(value)
    && typeof value.rewritten === 'string'
    && isOptionalString(value.current)
    && isOptionalNumber(value.charCount);
}

function isAboutSection(value: unknown): value is NonNullable<LinkedInOptimizeOutput['about']> {
  return isObject(value)
    && typeof value.rewritten === 'string'
    && isOptionalString(value.current);
}

function isExperienceBullet(value: unknown): value is NonNullable<LinkedInOptimizeOutput['experienceBullets']>[number] {
  return isObject(value)
    && typeof value.role === 'string'
    && typeof value.original === 'string'
    && typeof value.rewritten === 'string';
}

function isLinkedInOptimizeOutput(data: unknown): data is LinkedInOptimizeOutput {
  return isObject(data)
    && (data.headline === undefined || isHeadlineSection(data.headline))
    && (data.about === undefined || isAboutSection(data.about))
    && (data.experienceBullets === undefined
      || (Array.isArray(data.experienceBullets) && data.experienceBullets.every(isExperienceBullet)))
    && isOptionalStringArray(data.keywordsAdded);
}

function isCourse(value: unknown): value is NonNullable<NonNullable<SkillsGapOutput['gaps']>[number]['course']> {
  return isObject(value)
    && typeof value.title === 'string'
    && typeof value.platform === 'string'
    && isOptionalString(value.url)
    && isOptionalNumber(value.durationHours);
}

function isGap(value: unknown): value is NonNullable<SkillsGapOutput['gaps']>[number] {
  return isObject(value)
    && typeof value.skill === 'string'
    && (value.priority === 'high' || value.priority === 'medium' || value.priority === 'low')
    && (value.course === undefined || isCourse(value.course))
    && isOptionalString(value.milestone30)
    && isOptionalString(value.milestone60)
    && isOptionalString(value.milestone90)
    && isOptionalNumber(value.weeklyHours);
}

function isSkillsGapOutput(data: unknown): data is SkillsGapOutput {
  return isObject(data)
    && (data.gaps === undefined || (Array.isArray(data.gaps) && data.gaps.every(isGap)))
    && isOptionalNumber(data.totalWeeklyHours)
    && isOptionalStringArray(data.priorityOrder)
    && isOptionalString(data.summary);
}

function humanizeSkillName(skillName: string): string {
  return skillName.replace(/-/g, ' ');
}

/**
 * Smart skill panel — routes to a dedicated rich UI for Phase 2 skills,
 * falls back to the generic renderer for all Phase 1 skills.
 */
export function SkillPanel({
  skillName = '',
  label = '',
  title = '',
  userJobId = '',
  state = 'idle',
  data = null,
  error = null,
  missingFields = [],
  isActive = false,
  open = true,
  children,
  onRun = () => {},
  onDismissAlert = () => {},
  onClose,
}: Props) {
  const [downloading, setDownloading] = React.useState(false);

  if (children) {
    if (!open) return null;

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title || label}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Close
            </button>
          )}
        </div>
        {children}
      </div>
    );
  }

  const handleDownload = async () => {
    if (!userJobId || !skillName) {
      toast.error('PDF download is unavailable right now.');
      return;
    }

    setDownloading(true);
    try {
      await toast.promise(
        skillsApi.downloadSkillPdf(userJobId, skillName),
        {
          loading: 'Generating PDF...',
          success: 'Your PDF download has started.',
          error: 'Could not generate the PDF. Please try again.',
        },
      );
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
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Generating...' : 'PDF'}
            </button>
          )}
          <button
            onClick={onRun}
            disabled={showLoading || state === 'waiting_answer'}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {showLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
          <CircleAlert className="h-4 w-4 animate-pulse" />
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
  data: SkillData;
  skillName: string;
}) {
  // Phase 2 rich panels
  switch (skillName) {
    case 'cover-letter':
      if (isCoverLetterOutput(data)) {
        return <CoverLetterPanel data={data} />;
      }
      return <StructuredSkillOutput data={data} warning={`We couldn't render the enhanced ${humanizeSkillName(skillName)} view, so the structured result is shown instead.`} />;
    case 'salary-negotiation':
      if (isSalaryNegotiationOutput(data)) {
        return <SalaryNegotiationPanel data={data} />;
      }
      return <StructuredSkillOutput data={data} warning={`We couldn't render the enhanced ${humanizeSkillName(skillName)} view, so the structured result is shown instead.`} />;
    case 'culture-fit':
      if (isCultureFitOutput(data)) {
        return <CultureFitPanel data={data} />;
      }
      return <StructuredSkillOutput data={data} warning={`We couldn't render the enhanced ${humanizeSkillName(skillName)} view, so the structured result is shown instead.`} />;
    case 'linkedin-optimize':
      if (isLinkedInOptimizeOutput(data)) {
        return <LinkedInOptimizePanel data={data} />;
      }
      return <StructuredSkillOutput data={data} warning={`We couldn't render the enhanced ${humanizeSkillName(skillName)} view, so the structured result is shown instead.`} />;
    case 'skills-gap-plan':
      if (isSkillsGapOutput(data)) {
        return <SkillsGapPlanPanel data={data} />;
      }
      return <StructuredSkillOutput data={data} warning={`We couldn't render the enhanced ${humanizeSkillName(skillName)} view, so the structured result is shown instead.`} />;
    default:
      break;
  }

  return <StructuredSkillOutput data={data} />;
}

function StructuredSkillOutput({
  data,
  warning,
}: {
  data: SkillData;
  warning?: string;
}) {
  if ('text' in data && typeof data.text === 'string') {
    return (
      <div className="space-y-3">
        {warning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {warning}
          </div>
        )}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans leading-relaxed">
            {data.text}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warning}
        </div>
      )}
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
