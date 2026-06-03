/** Explains how matched vs gap skills are derived in AI match analysis. */
export function MatchSkillsLegend({ className = '' }: { className?: string }) {
  return (
    <p
      className={`font-body-sm text-body-sm text-on-surface-variant leading-relaxed ${className}`}
      data-testid="match-skills-legend"
    >
      <strong className="text-on-surface">How we compare skills:</strong> we list every skill mentioned in the job
      description, then check your <strong className="text-on-surface">entire CV</strong> (experience, projects, skills
      — not just the Skills section) for each one.{' '}
      <span className="text-emerald-800">Matched</span> = that JD skill appears somewhere in your CV
      (React and React.js count as the same).{' '}
      <span className="text-amber-900">Gaps</span> = the posting asks for it but we could not find it in your CV.
    </p>
  );
}
