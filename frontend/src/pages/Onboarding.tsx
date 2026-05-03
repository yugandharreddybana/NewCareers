import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { profileApi } from '@/services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudUpload, Briefcase, MapPin,
  ArrowLeft, ChevronRight, FileText, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Constants ─────────────────────────────────────────────────────────────
const SENIORITY_OPTIONS = ['Junior', 'Mid-Level', 'Senior', 'Lead / Principal'];
const REMOTE_OPTIONS    = ['On-site', 'Hybrid', 'Remote'];
const ONSITE_DAY_OPTIONS = [
  '1 Day per week',
  '2 Days per week',
  '3 Days per week',
  '4 Days per week',
  '5 Days per week (Full on-site)',
];

const TOTAL_STEPS = 3;

// ─── Small reusable components ───────────────────────────────────────────────────
// Step progress pills at the top
function StepPills({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            'h-2 rounded-full transition-all duration-300',
            i < current  ? 'w-12 bg-emerald-500' :
            i === current ? 'w-10 bg-emerald-500' :
                            'w-8 bg-slate-200',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

// Back button
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 font-medium mb-6 transition-colors"
    >
      <ArrowLeft size={15} />
      Back
    </button>
  );
}

// Form label
function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold text-slate-700 mb-2">{children}</p>
  );
}

// Native select styled
function StyledSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all appearance-none cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '18px', paddingRight: '40px' }}
    >
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main onboarding flow
// ─────────────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { updateProfile, user } = useAuth();
  const nav     = useNavigate();
  const cvRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.onboarded) {
      nav('/dashboard', { replace: true });
    }
  }, [user, nav]);

  const [step,   setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — CV
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Step 1 — Target Blueprint
  const [targetRoles, setTargetRoles] = useState('');
  const [techStack,   setTechStack]   = useState('');

  // Step 2 — Work Context
  const [seniority,    setSeniority]    = useState('Mid-Level');
  const [remotePolicy, setRemotePolicy] = useState('Hybrid');
  const [onsiteDays,   setOnsiteDays]   = useState('2 Days per week');
  const [sponsorship,  setSponsorship]  = useState(false);

  // Validation per step
  const canAdvance = (): boolean => {
    if (step === 0) return true;                  // CV optional
    if (step === 1) return targetRoles.trim().length > 0; // need at least one role
    return true;
  };

  // Final submit
  async function handleFinish() {
    setSaving(true);
    try {
      if (cvFile) {
        await profileApi.uploadCv(cvFile);
      }
      const roles  = targetRoles.split(',').map(r => r.trim()).filter(Boolean);
      const stack  = techStack.split(',').map(s => s.trim()).filter(Boolean);
      const expMap: Record<string, string> = {
        'Junior': 'junior', 'Mid-Level': 'mid',
        'Senior': 'senior', 'Lead / Principal': 'lead',
      };
      await updateProfile({
        targetRole:          roles[0] ?? '',
        skills:              [...roles, ...stack],
        experienceLevel:     expMap[seniority] ?? 'mid',
        sponsorshipRequired: sponsorship,
        location:            'Dublin',
        onboardingCompleted: true,
      } as any);
      nav('/dashboard');
    } catch {
      toast.error('Could not save your profile — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Minimal header ── */}
      <header className="h-14 px-6 flex items-center justify-between bg-white border-b border-slate-200">
        <span className="font-bold text-base text-slate-900">
          Career<span className="text-emerald-500">Ops</span>
        </span>
        <span className="text-xs text-slate-400 font-medium">Step {step + 1} of {TOTAL_STEPS}</span>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">

          {/* Step pills */}
          <StepPills current={step} total={TOTAL_STEPS} />

          {/* Animated card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200"
            >

              {/* Back button (steps 1+) */}
              {step > 0 && <BackBtn onClick={() => setStep(s => s - 1)} />}

              {/* ────────── STEP 0: CV UPLOAD ────────── */}
              {step === 0 && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                      <FileText size={28} className="text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Let's build your pipeline</h2>
                    <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                      Start by uploading your primary CV. The engine uses this to understand your entire history,
                      mapping it against live job requirements.
                    </p>
                  </div>

                  {/* Upload zone */}
                  <div
                    className={[
                      'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
                      cvFile
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:border-emerald-300 hover:bg-emerald-50/40',
                    ].join(' ')}
                    onClick={() => cvRef.current?.click()}
                  >
                    <input
                      ref={cvRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={e => setCvFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <CloudUpload size={22} className={cvFile ? 'text-emerald-500' : 'text-slate-400'} />
                    </div>
                    {cvFile ? (
                      <>
                        <p className="font-semibold text-emerald-700 text-sm text-center">{cvFile.name}</p>
                        <p className="text-xs text-emerald-500">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-700 text-sm">Upload your CV</p>
                        <p className="text-xs text-slate-400">Drag and drop, or click to browse</p>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); cvRef.current?.click(); }}
                          className="mt-1 px-5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-all shadow-sm"
                        >
                          Select File
                        </button>
                        <p className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">PDF, WORD, OR TXT (MAX 5MB)</p>
                      </>
                    )}
                  </div>

                  {/* Next */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setStep(1)}
                      className="flex items-center gap-2 px-6 h-11 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
                    >
                      Next Step <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ────────── STEP 1: TARGET BLUEPRINT ────────── */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Briefcase size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Target Blueprint</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        What exactly are we hunting for? The engine uses this strictly for semantic matching.
                      </p>
                    </div>
                  </div>

                  {/* Target roles */}
                  <div>
                    <Label>
                      Target Roles <span className="text-slate-400 font-normal text-xs">(comma separated)</span>
                    </Label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. Frontend Engineer, React Developer"
                      value={targetRoles}
                      onChange={e => setTargetRoles(e.target.value)}
                      required
                      className="w-full px-4 h-12 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                    />
                  </div>

                  {/* Tech stack */}
                  <div>
                    <Label>Core Tech Stack</Label>
                    <textarea
                      rows={4}
                      placeholder="React, TypeScript, Node.js..."
                      value={techStack}
                      onChange={e => setTechStack(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-none"
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      List the absolute non-negotiable tools. We'll penalize jobs heavily if they demand things outside this list.
                    </p>
                  </div>

                  {/* Next */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => { if (canAdvance()) setStep(2); }}
                      disabled={!canAdvance()}
                      className="flex items-center gap-2 px-6 h-11 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next Step <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ────────── STEP 2: WORK CONTEXT ────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Work Context</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Set your hard limitations. The engine will drop jobs that violate these constraints natively.
                      </p>
                    </div>
                  </div>

                  {/* Seniority */}
                  <div>
                    <Label>Seniority</Label>
                    <StyledSelect value={seniority} onChange={setSeniority} options={SENIORITY_OPTIONS} />
                  </div>

                  {/* Remote policy */}
                  <div>
                    <Label>Remote Policy</Label>
                    <StyledSelect value={remotePolicy} onChange={setRemotePolicy} options={REMOTE_OPTIONS} />
                  </div>

                  {/* Max on-site days — only when Hybrid */}
                  <AnimatePresence>
                    {remotePolicy === 'Hybrid' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <Label>Max On-Site Days</Label>
                        <StyledSelect value={onsiteDays} onChange={setOnsiteDays} options={ONSITE_DAY_OPTIONS} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Visa sponsorship */}
                  <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-emerald-300 transition-all">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={sponsorship}
                        onChange={e => setSponsorship(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 rounded border-2 border-slate-300 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center transition-all">
                        {sponsorship && <Check size={12} className="text-white" strokeWidth={3} />}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Requires Visa Sponsorship</p>
                      <p className="text-xs text-slate-400 mt-0.5">Check this if you require a Critical Skills permit in Ireland</p>
                    </div>
                  </label>

                  {/* Initialize pipeline CTA */}
                  <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="w-full h-14 bg-slate-900 text-white rounded-xl font-bold text-base hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Initializing…
                      </span>
                    ) : (
                      <>
                        <span>Initialize Pipeline Profiles</span>
                        <span className="text-emerald-400 font-mono text-lg leading-none">&lt;&gt;</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-400">
                    By initializing, you authorize the engine to aggressively scan matching positions across the job market.
                  </p>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
