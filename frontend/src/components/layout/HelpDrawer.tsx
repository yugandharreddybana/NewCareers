interface Props { open: boolean; onClose: () => void; }

const SKILLS: Array<{ name: string; what: string; where: string }> = [
  { name: 'Full Evaluation', what: 'Detailed A–F analysis: summary, fit, positioning, comp, tailoring, interview prep.', where: 'Job Detail' },
  { name: 'Tailor My CV', what: 'Two-column diff of your current CV vs a rewritten version targeted at this job.', where: 'Job Detail' },
  { name: 'Research Company', what: 'What they do, culture, salary benchmarks, recent news, red/green flags.', where: 'Job Detail' },
  { name: 'Draft Outreach', what: 'Short, specific LinkedIn or email draft to a hiring manager. Editable.', where: 'Job Detail' },
  { name: 'Apply Assistant', what: 'Step-by-step: cover letter → application questions → pre-submit checklist.', where: 'Job Detail' },
  { name: 'Prep Interview', what: 'Likely questions, talking points, study plan, questions to ask the interviewer.', where: 'Job Detail' },
  { name: 'Compare All', what: 'Side-by-side comparison across saved jobs (salary, fit, growth, culture, sponsorship).', where: 'Dashboard' },
  { name: 'Triage All', what: 'Re-rank everything in your pipeline with one-line verdicts.', where: 'Dashboard' },
  { name: 'Track', what: 'The Kanban board — Discovered (bookmark saves stay here) → Applied → Interview → Offer → Archived.', where: 'Kanban' },
];

export default function HelpDrawer({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-full sm:w-[440px] bg-white shadow-2xl overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center">
          <h2 className="text-lg font-semibold">NewCareers Skills</h2>
          <button className="ml-auto btn btn-ghost text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500">Each button below calls a Gemini-powered skill from <code className="text-xs">career-ops-skills/</code>.</p>
          {SKILLS.map(s => (
            <div key={s.name} className="card p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-medium">{s.name}</h3>
                <span className="chip-slate">{s.where}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{s.what}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
