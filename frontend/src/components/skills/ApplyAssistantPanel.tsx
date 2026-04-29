import { useState } from 'react';
import SkillPanel from './SkillPanel';
import toast from 'react-hot-toast';
import { kanbanApi } from '@/services/api';

interface Props { data: any; open: boolean; onClose: () => void; userJobId: string; onApplied?: () => void; }

export default function ApplyAssistantPanel({ data, open, onClose, userJobId, onApplied }: Props) {
  const [step, setStep] = useState(0);
  const steps = ['Cover Letter', 'Application Questions', 'Pre-submit Checklist'];
  if (!data) return null;

  async function markApplied() {
    try {
      await kanbanApi.patch(userJobId, { kanbanColumn: 'Applied', status: 'applied' });
      toast.success('Moved to Applied in Kanban');
      onApplied?.();
      onClose();
    } catch { toast.error('Could not update Kanban'); }
  }

  return (
    <SkillPanel title="Apply Assistant" open={open} onClose={onClose}>
      {/* Step tabs */}
      <div className="flex gap-1 mb-5">
        {steps.map((s, i) => (
          <button key={i}
            className={`btn text-xs flex-1 ${i === step ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStep(i)}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cover Letter</div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {data.coverLetter || 'No cover letter generated.'}
          </div>
          <button className="btn btn-secondary w-full text-sm"
            onClick={() => { navigator.clipboard.writeText(data.coverLetter || ''); toast.success('Copied'); }}>
            Copy cover letter
          </button>
          <button className="btn btn-primary w-full" onClick={() => setStep(1)}>Next →</button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Application Questions</div>
          {(data.questionAnswers || []).map((qa: any, i: number) => (
            <div key={i} className="space-y-1">
              <div className="font-medium text-ink-900">{qa.question}</div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700 leading-relaxed">
                {qa.answer}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary flex-1" onClick={() => setStep(2)}>Next →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pre-submit Checklist</div>
          <ul className="space-y-2">
            {(data.preSubmitChecklist || []).map((item: string, i: number) => (
              <CheckItem key={i} text={item} />
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <button className="btn btn-secondary flex-1" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-accent flex-1" onClick={markApplied}>
              ✓ Mark as Applied
            </button>
          </div>
        </div>
      )}
    </SkillPanel>
  );
}

function CheckItem({ text }: { text: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <li
      className={`flex gap-3 items-start p-2.5 rounded-lg cursor-pointer transition-colors
        ${checked ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-700'}`}
      onClick={() => setChecked(c => !c)}>
      <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0
        ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
        {checked && '✓'}
      </span>
      {text}
    </li>
  );
}
