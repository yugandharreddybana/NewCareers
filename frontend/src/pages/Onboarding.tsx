import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AuthLayout from '@/components/ui/AuthLayout';
import TagInput from '@/components/ui/TagInput';
import { profileApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const SECTORS = ['IT','Healthcare','Finance','Legal','Creative','Other'];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>(['IT']);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [location, setLocation] = useState('Dublin');
  const [salaryMin, setSalaryMin] = useState(50000);
  const [salaryMax, setSalaryMax] = useState(110000);
  const [sponsorship, setSponsorship] = useState(false);
  const [freshness, setFreshness] = useState(96);
  const [minMatch, setMinMatch] = useState(60);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { user, setUser } = useAuth();
  const nav = useNavigate();

  async function saveStep(next: number) {
    setBusy(true);
    try {
      await profileApi.update({
        targetRoles, sectors, techStack, location,
        salaryMin, salaryMax, sponsorshipRequired: sponsorship,
        freshnessHours: freshness, minMatchPercent: minMatch
      });
      setStep(next);
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed'); }
    finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try {
      if (cvFile) await profileApi.uploadCv(cvFile);
      await profileApi.update({ onboarded: true });
      if (user) setUser({ ...user, onboarded: true });
      toast.success('All set — fetching your first jobs…');
      nav('/dashboard', { replace: true });
    } catch (e: any) { toast.error(e.normalizedMessage || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <AuthLayout title={`Step ${step} of 3`} subtitle={titles[step-1]}>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-ink-900" style={{ width: `${(step/3)*100}%` }} />
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <div><label className="text-sm">Target roles</label>
            <TagInput value={targetRoles} onChange={setTargetRoles}
              placeholder="e.g. Software Engineer, Full-stack Developer" /></div>
          <div><label className="text-sm">Sectors</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {SECTORS.map(s => (
                <button key={s} type="button"
                  className={`chip ${sectors.includes(s) ? 'bg-ink-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                  onClick={() => setSectors(sectors.includes(s) ? sectors.filter(x=>x!==s) : [...sectors, s])}>
                  {s}
                </button>
              ))}
            </div></div>
          <button className="btn btn-primary w-full" disabled={busy || targetRoles.length === 0} onClick={() => saveStep(2)}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div><label className="text-sm">Tech stack</label>
            <TagInput value={techStack} onChange={setTechStack} placeholder="e.g. React, Node.js, Java" /></div>
          <div><label className="text-sm">Location preference</label>
            <select className="input mt-1" value={location} onChange={e=>setLocation(e.target.value)}>
              <option>Dublin</option><option>Remote</option><option>Hybrid</option><option>Other Ireland</option>
            </select></div>
          <div><label className="text-sm">Salary range (EUR)</label>
            <div className="flex items-center gap-3 mt-1">
              <input type="number" min={0} step={5000} className="input" value={salaryMin} onChange={e=>setSalaryMin(+e.target.value)} />
              <span className="text-slate-400">to</span>
              <input type="number" min={0} step={5000} className="input" value={salaryMax} onChange={e=>setSalaryMax(+e.target.value)} />
            </div></div>
          <div className="flex items-center gap-3">
            <label className="text-sm">Sponsorship needed</label>
            <button type="button"
              onClick={() => setSponsorship(s => !s)}
              className={`btn ${sponsorship ? 'btn-accent' : 'btn-secondary'}`}>{sponsorship ? 'Yes' : 'No'}</button>
          </div>
          <div><label className="text-sm">Freshness</label>
            <div className="flex gap-2 mt-1">
              {[24,48,72,96].map(h => (
                <button key={h} type="button"
                  className={`btn ${freshness===h ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFreshness(h)}>{h}h</button>
              ))}
            </div></div>
          <div><label className="text-sm">Minimum match: <b>{minMatch}%</b></label>
            <input type="range" min={50} max={90} value={minMatch}
              onChange={e=>setMinMatch(+e.target.value)} className="w-full" /></div>
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary flex-1" disabled={busy} onClick={() => saveStep(3)}>Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
            <input type="file" accept=".pdf,.docx" className="hidden" id="cv"
              onChange={e => setCvFile(e.target.files?.[0] || null)} />
            <label htmlFor="cv" className="cursor-pointer">
              <div className="font-medium">Drop your CV here or click to upload</div>
              <div className="text-xs text-slate-500 mt-1">PDF or DOCX, up to 5MB</div>
              {cvFile && <div className="mt-3 text-sm text-emerald-600">{cvFile.name}</div>}
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary flex-1" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary flex-1" disabled={busy || !cvFile} onClick={finish}>{busy ? 'Finishing…' : 'Finish setup'}</button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

const titles = [
  'Tell us what roles you want',
  'Set your preferences',
  'Upload your CV'
];
