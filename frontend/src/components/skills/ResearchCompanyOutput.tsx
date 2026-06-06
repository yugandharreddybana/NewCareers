type NewsItem = { headline?: string | undefined; summary?: string | undefined; dateHint?: string | undefined };
type CultureBlock = {
  overview?: string | undefined;
  workStyle?: string | undefined;
  positiveThemes?: string[];
  negativeThemes?: string[];
};
type CompensationBlock = {
  signals?: string | undefined;
  salaryBandHint?: string | undefined;
  currency?: string | undefined;
};
type InterviewBlock = {
  values?: string | undefined;
  priorities?: string | undefined;
  questionsToAsk?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (isRecord(item)) {
        const headline = asString(item.headline);
        const summary = asString(item.summary);
        const dateHint = asString(item.dateHint);
        if (headline && summary) {
          return dateHint ? `${headline} — ${summary} (${dateHint})` : `${headline} — ${summary}`;
        }
        return headline ?? summary;
      }
      return '';
    })
    .filter((item): item is string => !!item);
}

function parseCulture(value: unknown): CultureBlock | null {
  if (typeof value === 'string' && value.trim()) {
    return { overview: value.trim() };
  }
  if (!isRecord(value)) return null;
  return {
    overview: asString(value.overview),
    workStyle: asString(value.workStyle),
    positiveThemes: asStringList(value.positiveThemes),
    negativeThemes: asStringList(value.negativeThemes),
  };
}

function parseNews(value: unknown): NewsItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'string') return { headline: item.trim() };
      if (!isRecord(item)) return null;
      const headline = asString(item.headline);
      const summary = asString(item.summary);
      const dateHint = asString(item.dateHint);
      if (!headline && !summary) return null;
      return { headline, summary, dateHint };
    })
    .filter((item): item is NewsItem => item !== null);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </section>
  );
}

function BulletList({
  items,
  tone = 'neutral',
}: {
  items: string[];
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  const icon =
    tone === 'positive' ? '✓' : tone === 'negative' ? '✗' : '•';
  const iconClass =
    tone === 'positive'
      ? 'text-emerald-500'
      : tone === 'negative'
        ? 'text-rose-500'
        : 'text-indigo-400';

  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          <span className={`shrink-0 mt-0.5 ${iconClass}`}>{icon}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type Props = { data: Record<string, unknown> };

/** Renders Research Company skill output (new nested JSON + legacy flat shape). */
export function ResearchCompanyOutput({ data }: Props) {
  const company = asString(data.company);
  const summary = asString(data.summary) ?? asString(data.whatTheyDo);
  const culture = parseCulture(data.culture);
  const news = parseNews(data.recentNews);
  const compensation = isRecord(data.compensation)
    ? (data.compensation as CompensationBlock)
    : null;
  const salaryBenchmark = isRecord(data.salaryBenchmark) ? data.salaryBenchmark : null;
  const riskFlags = asStringList(data.riskFlags).length
    ? asStringList(data.riskFlags)
    : asStringList(data.redFlags);
  const greenFlags = asStringList(data.greenFlags);
  const interview = isRecord(data.interviewIntelligence)
    ? (data.interviewIntelligence as InterviewBlock)
    : null;
  const interviewStyle = asString(data.interviewStyle);
  const legacyQuestions = asStringList(data.questionsToAsk);
  const limitations = asString(data.limitations);

  return (
    <div className="space-y-5">
      {company && (
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{company}</p>
      )}

      {summary && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
        </div>
      )}

      {culture && (culture.overview || culture.workStyle || culture.positiveThemes?.length || culture.negativeThemes?.length) && (
        <Section title="Culture">
          {culture.overview && (
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{culture.overview}</p>
          )}
          {culture.workStyle && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">Work style: </span>
              {culture.workStyle}
            </p>
          )}
          {culture.positiveThemes && culture.positiveThemes.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">Positive themes</p>
              <BulletList items={culture.positiveThemes} tone="positive" />
            </div>
          )}
          {culture.negativeThemes && culture.negativeThemes.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-rose-700 dark:text-rose-400 mb-1">Watch-outs</p>
              <BulletList items={culture.negativeThemes} tone="negative" />
            </div>
          )}
        </Section>
      )}

      {news.length > 0 && (
        <Section title="Recent news">
          <ul className="space-y-3">
            {news.map((item, i) => (
              <li key={i} className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                {item.headline && <p className="font-medium">{item.headline}</p>}
                {item.summary && <p className="text-gray-600 dark:text-gray-400 mt-0.5">{item.summary}</p>}
                {item.dateHint && (
                  <p className="text-xs text-gray-400 mt-1">{item.dateHint}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(compensation?.signals || compensation?.salaryBandHint || salaryBenchmark) && (
        <Section title="Compensation">
          {compensation?.signals && (
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{compensation.signals}</p>
          )}
          {compensation?.salaryBandHint && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              <span className="font-medium">Typical band: </span>
              {compensation.salaryBandHint}
              {compensation.currency ? ` ${compensation.currency}` : ''}
            </p>
          )}
          {salaryBenchmark && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {Object.entries(salaryBenchmark).map(([level, val]) => (
                <div
                  key={level}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-center"
                >
                  <div className="text-xs text-gray-400 capitalize">{level}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{String(val)}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {greenFlags.length > 0 && (
        <Section title="Green flags">
          <BulletList items={greenFlags} tone="positive" />
        </Section>
      )}

      {riskFlags.length > 0 && (
        <Section title="Risk flags">
          <BulletList items={riskFlags} tone="negative" />
        </Section>
      )}

      {(interview?.values || interview?.priorities || interviewStyle) && (
        <Section title="Interview intelligence">
          {interview?.values && (
            <p className="text-sm text-gray-800 dark:text-gray-200">
              <span className="font-medium">Values: </span>
              {interview.values}
            </p>
          )}
          {interview?.priorities && (
            <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">
              <span className="font-medium">Priorities: </span>
              {interview.priorities}
            </p>
          )}
          {interviewStyle && (
            <p className="text-sm text-gray-800 dark:text-gray-200 mt-1">{interviewStyle}</p>
          )}
        </Section>
      )}

      {((interview?.questionsToAsk?.length ?? 0) > 0 || legacyQuestions.length > 0) && (
        <Section title="Questions to ask them">
          <ol className="space-y-1.5 list-decimal list-inside text-sm text-gray-800 dark:text-gray-200">
            {(interview?.questionsToAsk ?? legacyQuestions).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </Section>
      )}

      {limitations && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-700 pt-3">
          {limitations}
        </p>
      )}
    </div>
  );
}
