import { useMemo, useState, type ReactNode } from 'react';
import type { Profile } from '@/types';
import {
  buildAtsKeywords,
  highlightAtsInText,
  partitionAtsKeywords,
} from '@/lib/atsKeywords';
import {
  blocksForCollapsedView,
  descriptionExceedsCollapseLimit,
  parseJobDescriptionBlocks,
  type JobDescBlock,
} from '@/lib/jobDescriptionFormat';
import { stripPostingMetaFromDescription } from '@/lib/jobPostingMeta';
import { plainJobDescription } from '@/lib/plainJobDescription';
type Props = {
  description: string;
  title?: string;
  profile?: Profile | null;
  matchedSkills?: string[];
  unmatchedSkills?: string[];
  salary?: string;
  location?: string;
  workModel?: string;
};

function inlineHighlighted(text: string, keywords: string[], keyPrefix: string): ReactNode[] {
  return highlightAtsInText(text, keywords).map((span, i) => (
    <span
      key={`${keyPrefix}-${i}`}
      className={span.tone === 'match' ? 'ats-keyword ats-keyword--match' : undefined}
    >
      {span.text}
    </span>
  ));
}

function renderBlock(
  block: JobDescBlock,
  keywords: string[],
  key: string,
): ReactNode {
  if (block.type === 'heading') {
    const Tag = block.level === 2 ? 'h3' : 'h4';
    return (
      <Tag key={key} className={block.level === 2 ? 'job-desc-heading' : 'job-desc-subheading'}>
        {inlineHighlighted(block.text, keywords, key)}
      </Tag>
    );
  }
  if (block.type === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return (
      <Tag key={key} className="job-desc-list">
        {block.items.map((item, i) => (
          <li key={i}>{inlineHighlighted(item, keywords, `${key}-li-${i}`)}</li>
        ))}
      </Tag>
    );
  }
  return (
    <p key={key} className="job-desc-paragraph">
      {inlineHighlighted(block.text, keywords, key)}
    </p>
  );
}

export function JobDescriptionView({
  description,
  title,
  profile,
  matchedSkills,
  unmatchedSkills,
  salary,
  location,
  workModel,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const plainDescription = useMemo(() => plainJobDescription(description), [description]);
  const bodyText = useMemo(
    () => stripPostingMetaFromDescription(plainDescription, {
      jobTitle: title,
      salaryLabel: salary,
      locationLabel: location,
      workArrangement: workModel,
    }),
    [plainDescription, title, salary, location, workModel],
  );
  const keywords = useMemo(() => buildAtsKeywords(profile), [profile]);

  const { matched, unmatched } = useMemo(() => {
    if (matchedSkills?.length || unmatchedSkills?.length) {
      return {
        matched: matchedSkills ?? [],
        unmatched: unmatchedSkills ?? [],
      };
    }
    const haystack = `${title ?? ''}\n${bodyText}`;
    return partitionAtsKeywords(haystack, keywords);
  }, [bodyText, title, keywords, matchedSkills, unmatchedSkills]);

  const allBlocks = useMemo(() => parseJobDescriptionBlocks(bodyText), [bodyText]);
  const canCollapse = useMemo(() => descriptionExceedsCollapseLimit(bodyText), [bodyText]);
  const visibleBlocks = useMemo(() => {
    if (!canCollapse || expanded) return allBlocks;
    return blocksForCollapsedView(allBlocks);
  }, [allBlocks, canCollapse, expanded]);

  if (!plainDescription.trim()) return null;

  return (
    <div className="job-description-view">
      {keywords.length > 0 && (
        <div className="job-desc-ats-legend" role="note">
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wide">
            ATS keywords (your profile)
          </span>
          <div className="job-desc-ats-legend__chips">
            {matched.map(kw => (
              <span key={`m-${kw}`} className="ats-chip ats-chip--match">
                {kw}
              </span>
            ))}
            {unmatched.map(kw => (
              <span key={`u-${kw}`} className="ats-chip ats-chip--gap" title="Not found in this posting">
                {kw}
              </span>
            ))}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
            <span className="ats-keyword ats-keyword--match">Green highlights</span> mark your skills that appear in
            the description.{' '}
            <span className="ats-chip ats-chip--gap">Red chips</span> are profile skills not found in this posting.
          </p>
        </div>
      )}

      <div
        className={[
          'job-desc-body',
          canCollapse && !expanded ? 'job-desc-body--collapsed' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {visibleBlocks.map((block, i) => renderBlock(block, keywords, `b-${i}`))}
      </div>

      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="job-desc-toggle mt-3 inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:underline"
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : 'Show more'}
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      )}
    </div>
  );
}

export default JobDescriptionView;
