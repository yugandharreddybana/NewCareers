import { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import toast from 'react-hot-toast';

import { skillsApi } from '@/services/skillsApi';

import {

  buildJobEvaluationPdfPayload,

  jobEvaluationPdfFilename,

} from '@/lib/downloadJobEvaluationPdf';

import type { JobDetail } from '@/types';

import { applyGate } from '@/lib/evaluationApplyGate';
import { EVALUATION_ADVISORY_FOOTER } from '@/lib/evaluationDisclaimers';
import {
  evaluationDimensionsForDisplay,
  hasStoredJobEvaluation,
  isPreviewEvaluation,
  resolveNextStepsForDisplay,
  type JobEvaluationView,
} from '@/lib/jobEvaluation';

import { EvaluationDimensionGrid } from '@/components/job-detail/EvaluationDimensionGrid';
import { MatchSkillsLegend } from '@/components/job-detail/MatchSkillsLegend';
import { SkillLoadingState } from '@/components/skills/SkillLoadingState';

import '@/styles/job-evaluation-modal.css';



type Props = {

  open: boolean;

  onClose: () => void;

  job: JobDetail;

  evaluation: JobEvaluationView;

  onRunDeepEvaluation?: () => Promise<void>;

  runningDeepEvaluation?: boolean;

};



const SECTION_LABELS: Array<{ key: keyof NonNullable<JobEvaluationView['sections']>; title: string }> = [

  { key: 'executiveSummary', title: 'Executive summary' },

  { key: 'backgroundMatch', title: 'Background match' },

  { key: 'positioningStrategy', title: 'Positioning strategy' },

  { key: 'compensationAndMarket', title: 'Compensation & market' },

  { key: 'tailoringPlan', title: 'CV tailoring plan' },

  { key: 'interviewPrep', title: 'Interview preparation' },

];

const SECTION_LETTERS: Record<keyof NonNullable<JobEvaluationView['sections']>, string> = {
  executiveSummary: 'A',
  backgroundMatch: 'B',
  positioningStrategy: 'C',
  compensationAndMarket: 'D',
  tailoringPlan: 'E',
  interviewPrep: 'F',
};



function verdictTone(verdict?: string): string {

  const v = (verdict ?? '').toLowerCase();

  if (v.includes('strong') || v.includes('worth')) {

    return 'bg-emerald-100 text-emerald-800 border-emerald-200';

  }

  if (v.includes('stretch')) return 'bg-amber-100 text-amber-800 border-amber-200';

  if (v.includes('skip')) return 'bg-rose-100 text-rose-800 border-rose-200';

  return 'bg-surface-container-high text-on-surface-variant border-outline-variant';

}

export function JobEvaluationModal({

  open,

  onClose,

  job,

  evaluation,

  onRunDeepEvaluation,

  runningDeepEvaluation = false,

}: Props) {
  const [downloading, setDownloading] = useState(false);
  const preview = isPreviewEvaluation(job, evaluation);
  const deepEvalBusy =
    runningDeepEvaluation || evaluation.evaluationStatus === 'running';

  useEffect(() => {

    if (!open) return;

    const onKey = (e: KeyboardEvent) => {

      if (e.key === 'Escape') onClose();

    };

    window.addEventListener('keydown', onKey);

    const prev = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {

      window.removeEventListener('keydown', onKey);

      document.body.style.overflow = prev;

    };

  }, [open, onClose]);



  const handleDownloadPdf = async () => {

    setDownloading(true);

    try {

      const payload = buildJobEvaluationPdfPayload(job, evaluation);

      const filename = jobEvaluationPdfFilename(job);

      await toast.promise(skillsApi.downloadEvaluationReportPdf(payload, filename), {
        loading: 'Generating evaluation PDF…',
        success: 'PDF download started.',
        error: err => (err instanceof Error ? err.message : 'Could not generate the PDF. Try again.'),
      });

    } finally {

      setDownloading(false);

    }

  };



  if (!open) return null;



  const sections = evaluation.sections ?? {};

  const hasFullSections = SECTION_LABELS.some(({ key }) => sections[key]?.trim());

  const stored = hasStoredJobEvaluation(job);

  const rubricDimensions = evaluationDimensionsForDisplay(evaluation);

  const hasRubric = rubricDimensions.length > 0;

  const canDownloadPdf = Boolean(

    evaluation.humanSummary ||

      evaluation.matchedSkills?.length ||

      evaluation.unmatchedSkills?.length ||

      evaluation.cvImprovementTips?.length ||

      hasFullSections ||

      hasRubric,

  );

  const gate = applyGate(evaluation.applyScore);

  const gateClass =

    gate.level === 'go'

      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'

      : gate.level === 'caution'

        ? 'bg-amber-50 text-amber-900 border-amber-200'

        : 'bg-rose-50 text-rose-900 border-rose-200';

  return createPortal(

    <div

      className="job-eval-modal-backdrop"

      role="presentation"

      onMouseDown={e => {

        if (e.target === e.currentTarget) onClose();

      }}

    >

      <div

        className="job-eval-modal"

        role="dialog"

        aria-modal="true"

        aria-labelledby="job-eval-modal-title"

      >

        <header className="job-eval-modal__header">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <p className="font-label-sm text-label-sm text-primary uppercase tracking-wide mb-1">

                AI job evaluation

              </p>

              <h2 id="job-eval-modal-title" className="font-headline-md text-headline-md text-on-surface">

                {job.title}

              </h2>

              <p className="font-body-md text-body-md text-secondary mt-0.5">

                {job.company} · {job.location}

              </p>

            </div>

            <div className="flex items-center gap-2 shrink-0">
              {stored && onRunDeepEvaluation && (
                <button
                  type="button"
                  onClick={() => void onRunDeepEvaluation()}
                  disabled={deepEvalBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container-high disabled:opacity-60 transition-colors"
                >
                  {deepEvalBusy ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      Re-running…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      Re-run evaluation
                    </>
                  )}
                </button>
              )}

            <button

              type="button"

              onClick={onClose}

              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-secondary hover:bg-surface-container-high hover:text-on-surface transition-colors"

              aria-label="Close evaluation"

            >

              <span className="material-symbols-outlined">close</span>

            </button>

            </div>

          </div>

          {evaluation.applyScore != null && (

            <>

              <div className="job-eval-apply-hero">

                <span className={`job-eval-apply-hero__score ${gateClass.includes('emerald') ? 'text-emerald-800' : gateClass.includes('amber') ? 'text-amber-800' : 'text-rose-800'}`}>

                  {evaluation.applyScore.toFixed(1)}

                  <span className="text-lg font-semibold text-on-surface-variant"> / 5</span>

                </span>

                <span className="font-label-md text-label-md text-on-surface-variant">Apply score</span>

                {evaluation.archetype && (

                  <span className="job-eval-archetype-pill">{evaluation.archetype}</span>

                )}

                {evaluation.legacy && (

                  <span className="job-eval-legacy-badge">Legacy format</span>

                )}

              </div>

              <p className={`mt-2 rounded-lg border px-3 py-2 text-sm ${gateClass}`} role="status">

                <strong>Apply gate:</strong> {gate.message}

              </p>

            </>

          )}



          {!evaluation.applyScore && evaluation.archetype && (

            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-secondary">

              <span className="job-eval-archetype-pill">{evaluation.archetype}</span>

              {evaluation.legacy && <span className="job-eval-legacy-badge">Legacy format</span>}

            </p>

          )}



          <div className="flex flex-wrap items-center gap-3 mt-4">

            {evaluation.matchPercent != null && (

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-label-md text-label-md font-bold">

                <span className="material-symbols-outlined text-[18px]">target</span>

                {evaluation.matchPercent}% match

              </span>

            )}

            {evaluation.overallScore != null && (

              <span className="font-body-sm text-body-sm text-on-surface-variant">

                Overall score: <strong className="text-on-surface">{evaluation.overallScore}/100</strong>

              </span>

            )}

            {evaluation.verdict && (

              <span

                className={`px-3 py-1 rounded-full border font-label-sm text-label-sm font-semibold ${verdictTone(evaluation.verdict)}`}

              >

                {evaluation.verdict}

              </span>

            )}

            {evaluation.fromDailyDelivery && (

              <span className="text-[11px] uppercase font-bold tracking-wide text-secondary">

                From daily job match

              </span>

            )}

          </div>



          {(evaluation.sponsorshipMatch != null || evaluation.salaryMatch != null) && (

            <div className="flex flex-wrap gap-4 mt-3 text-body-sm text-on-surface-variant">

              {evaluation.sponsorshipMatch != null && (

                <span>

                  Sponsorship:{' '}

                  <strong className={evaluation.sponsorshipMatch ? 'text-emerald-700' : 'text-amber-700'}>

                    {evaluation.sponsorshipMatch ? 'Aligned' : 'Check posting'}

                  </strong>

                </span>

              )}

              {evaluation.salaryMatch != null && (

                <span>

                  Salary band:{' '}

                  <strong className={evaluation.salaryMatch ? 'text-emerald-700' : 'text-amber-700'}>

                    {evaluation.salaryMatch ? 'Within target' : 'Review range'}

                  </strong>

                </span>

              )}

            </div>

          )}

        </header>



        <div className="job-eval-modal__body space-y-6">
          {deepEvalBusy ? (
            <SkillLoadingState label="Running full AI evaluation against your CV and this posting…" />
          ) : (
            <>
          {evaluation.humanSummary && (
            <p className="font-body-md text-body-md text-on-surface leading-relaxed border-l-4 border-primary pl-4">
              {evaluation.humanSummary}
            </p>
          )}



          {hasRubric && (

            <EvaluationDimensionGrid
              dimensions={rubricDimensions}
              {...(evaluation.legacy ? { legacy: true } : {})}
            />

          )}



          <MatchSkillsLegend className="mb-4" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="job-eval-pillar job-eval-pillar--strong">

              <h3 className="font-label-md text-label-md text-emerald-800 mb-2 flex items-center gap-1.5">

                <span className="material-symbols-outlined text-[20px]">thumb_up</span>

                What&apos;s strong (your CV ↔ posting)

              </h3>

              {(evaluation.matchedSkills?.length ?? 0) > 0 ? (

                <ul className="space-y-2 mb-3">

                  {evaluation.matchedSkills!.map(skill => (

                    <li key={skill} className="flex gap-2 text-body-sm text-emerald-900">

                      <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>

                      {skill}

                    </li>

                  ))}

                </ul>

              ) : (

                <p className="text-body-sm text-emerald-900/80 mb-2">No explicit skill matches recorded yet.</p>

              )}

              {sections.backgroundMatch && (

                <p className="text-body-sm text-emerald-950/90 leading-relaxed whitespace-pre-wrap">

                  {sections.backgroundMatch}

                </p>

              )}

            </div>



            <div className="job-eval-pillar job-eval-pillar--improve">

              <h3 className="font-label-md text-label-md text-amber-900 mb-2 flex items-center gap-1.5">

                <span className="material-symbols-outlined text-[20px]">warning</span>

                Gaps &amp; CV coaching

              </h3>

              {(evaluation.unmatchedSkills?.length ?? 0) > 0 && (

                <ul className="space-y-2 mb-3">

                  {evaluation.unmatchedSkills!.map(skill => (

                    <li key={skill} className="flex gap-2 text-body-sm text-amber-950">

                      <span className="material-symbols-outlined text-[16px] shrink-0">cancel</span>

                      {skill}

                    </li>

                  ))}

                </ul>

              )}

              {(evaluation.cvImprovementTips?.length ?? 0) > 0 ? (

                <ul className="space-y-2">

                  {evaluation.cvImprovementTips!.map(tip => (

                    <li key={tip} className="flex gap-2 text-body-sm text-amber-950 leading-relaxed">

                      <span className="text-amber-600 shrink-0">→</span>

                      {tip}

                    </li>

                  ))}

                </ul>

              ) : (

                !evaluation.unmatchedSkills?.length && (

                  <p className="text-body-sm text-amber-950/80">No critical gaps flagged for this role.</p>

                )

              )}

            </div>



            <div className="job-eval-pillar job-eval-pillar--action">

              <h3 className="font-label-md text-label-md text-blue-900 mb-2 flex items-center gap-1.5">

                <span className="material-symbols-outlined text-[20px]">playlist_add_check</span>

                What to do next

              </h3>

              <ul className="space-y-3 text-body-sm text-blue-950 leading-relaxed">

                {resolveNextStepsForDisplay(evaluation).map(step => (
                    <li key={step} className="flex gap-2">
                      <span className="text-blue-600 shrink-0">→</span>
                      <span>{step}</span>
                    </li>
                  ))}

                {sections.positioningStrategy && (

                  <li>

                    <strong className="block text-blue-900 mb-0.5">Position yourself</strong>

                    {sections.positioningStrategy}

                  </li>

                )}

                {sections.tailoringPlan && (

                  <li>

                    <strong className="block text-blue-900 mb-0.5">Tailor your CV</strong>

                    {sections.tailoringPlan}

                  </li>

                )}

                {sections.interviewPrep && (

                  <li>

                    <strong className="block text-blue-900 mb-0.5">Prepare for interviews</strong>

                    {sections.interviewPrep}

                  </li>

                )}

              </ul>

            </div>

          </div>



          {hasFullSections && (

            <div className="space-y-4 pt-2 border-t border-outline-variant">

              <h3 className="font-headline-sm text-headline-sm text-on-surface">Full analysis (A–F)</h3>

              {SECTION_LABELS.map(({ key, title }) => {

                const text = sections[key];

                if (!text?.trim()) return null;

                return (

                  <section

                    key={key}

                    className="rounded-xl border border-outline-variant bg-surface-container-low p-4"

                  >

                    <h4 className="font-label-md text-label-md text-primary uppercase tracking-wider mb-2">
                      {SECTION_LETTERS[key]}. {title}

                    </h4>

                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap">

                      {text}

                    </p>

                  </section>

                );

              })}

            </div>

          )}

          {(evaluation.storyBankCandidates?.length ?? 0) > 0 && (
            <section className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Story bank candidates</h3>
              <ul className="space-y-2 text-body-sm text-on-surface-variant">
                {evaluation.storyBankCandidates!.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="text-primary shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}



          {!preview && !stored && !hasFullSections && (

            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">

              <p className="font-body-md text-body-md text-on-surface-variant mb-4">

                This role does not have a stored evaluation yet. CareerOps runs evaluation automatically when

                new jobs are delivered to your pipeline each day.

              </p>

              {onRunDeepEvaluation && (

                <button

                  type="button"

                  onClick={() => void onRunDeepEvaluation()}

                  disabled={deepEvalBusy}

                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container disabled:opacity-60"

                >

                  {deepEvalBusy ? (

                    <>

                      <span className="material-symbols-outlined animate-spin text-[20px]">

                        progress_activity

                      </span>

                      Running evaluation…

                    </>

                  ) : (

                    <>

                      <span className="material-symbols-outlined text-[20px]">auto_awesome</span>

                      Run deep evaluation now

                    </>

                  )}

                </button>

              )}

            </div>

          )}



          <p className="job-eval-modal__disclaimer">{EVALUATION_ADVISORY_FOOTER}</p>
            </>
          )}
        </div>



        <footer className="flex-shrink-0 flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant bg-surface-container-low">

          <button

            type="button"

            onClick={onClose}

            className="px-4 py-2.5 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface hover:bg-surface-container-high transition-colors"

          >

            Close

          </button>

          <button

            type="button"

            onClick={() => void handleDownloadPdf()}

            disabled={downloading || !canDownloadPdf}
            title={
              !canDownloadPdf
                ? 'Run an evaluation first to download a report'
                : undefined
            }

            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container disabled:opacity-50 transition-colors"

          >

            <span className="material-symbols-outlined text-[20px]">download</span>

            {downloading ? 'Generating…' : 'Download PDF'}

          </button>

        </footer>

      </div>

    </div>,

    document.body,

  );

}



export default JobEvaluationModal;

