import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { profileApi } from '@/services/api';
import { Profile, Stats } from '@/types';
import { useAuth } from '@/context/AuthContext';
import TagInput from '@/components/ui/TagInput';
import {
  User, Settings, FileText, Download,
  Upload, Lock, Euro, MapPin,
  Target, Zap, Clock, ShieldCheck,
  ChevronRight, CheckCircle2, AlertCircle,
  Camera, Mail, AtSign,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
type ProfileTab = 'personal' | 'cv' | 'preferences' | 'account';

const NAV_ITEMS: { id: ProfileTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'personal',     label: 'Personal Info',  icon: <User size={16} />,     desc: 'Name, email, location' },
  { id: 'cv',          label: 'CV Management',   icon: <FileText size={16} />, desc: 'Upload and manage your CV' },
  { id: 'preferences', label: 'Preferences',     icon: <Settings size={16} />, desc: 'Job matching settings' },
  { id: 'account',     label: 'Account',         icon: <Lock size={16} />,     desc: 'Password and security' },
];

// ─── Circular completeness ring ────────────────────────────────────────────────────
function CompletenessRing({ percent }: { percent: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  const colour = percent >= 80 ? '#10B981' : percent >= 50 ? '#6366F1' : '#F59E0B';

  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-slate-800">{percent}%</span>
      </div>
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────────
function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6 pb-5 border-b border-slate-100">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
    </div>
  );
}

// ─── Field row wrapper ───────────────────────────────────────────────────────────
function FieldRow({
  label, hint, icon, children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab]   = useState<ProfileTab>('personal');
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [saving, setSaving]         = useState(false);
  const [cvFile, setCvFile]         = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [pwMode, setPwMode]         = useState(false);
  const cvInputRef                  = useRef<HTMLInputElement>(null);

  // Editable preference fields
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [techStack, setTechStack]     = useState<string[]>([]);
  const [location, setLocation]       = useState('Dublin');
  const [salaryMin, setSalaryMin]     = useState(50000);
  const [salaryMax, setSalaryMax]     = useState(110000);
  const [sponsorship, setSponsorship] = useState(false);
  const [freshness, setFreshness]     = useState(96);
  const [minMatch, setMinMatch]       = useState(60);

  useEffect(() => {
    Promise.all([profileApi.get(), profileApi.stats()])
      .then(([p, s]) => {
        setProfile(p);
        setStats(s);
        setTargetRoles(p.targetRoles || []);
        setTechStack(p.techStack || []);
        setLocation(p.location || 'Dublin');
        setSalaryMin(p.salaryMin || 50000);
        setSalaryMax(p.salaryMax || 110000);
        setSponsorship(p.sponsorshipRequired || false);
        setFreshness(p.freshnessHours || 96);
        setMinMatch(p.minMatchPercent || 60);
      })
      .catch(() => toast.error('Failed to load profile'));
  }, []);

  // ── Completeness calculation ──────────────────────────────────────────────────
  const completenessChecks = [
    { label: 'CV uploaded',       done: !!profile?.activeCvFileName,       points: 30 },
    { label: 'Target roles set',  done: targetRoles.length > 0,            points: 20 },
    { label: 'Tech stack added',  done: techStack.length > 0,              points: 20 },
    { label: 'Location set',      done: !!location && location !== '',      points: 10 },
    { label: 'Salary range set',  done: salaryMin > 0 && salaryMax > 0,    points: 10 },
    { label: 'Match threshold',   done: minMatch > 0,                      points: 10 },
  ];
  const completeness = completenessChecks.reduce((acc, c) => acc + (c.done ? c.points : 0), 0);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function savePreferences() {
    setSaving(true);
    try {
      await profileApi.update({
        targetRoles, techStack, location,
        salaryMin, salaryMax,
        sponsorshipRequired: sponsorship,
        freshnessHours: freshness,
        minMatchPercent: minMatch,
      });
      toast.success('Preferences saved');
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function uploadCv() {
    if (!cvFile) return;
    setUploadingCv(true);
    try {
      await profileApi.uploadCv(cvFile);
      const p = await profileApi.get();
      setProfile(p);
      setCvFile(null);
      toast.success('CV uploaded successfully');
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Upload failed');
    } finally {
      setUploadingCv(false);
    }
  }

  async function downloadCv() {
    try {
      const { url } = await profileApi.cvDownload();
      if (url) window.open(url, '_blank');
      else toast.error('No CV uploaded yet');
    } catch {
      toast.error('Download failed');
    }
  }

  const initials = user?.name
    ?.split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">

      {/* ── Profile header card ── */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 mb-6 shadow-sm mt-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-sm">
              {initials}
            </div>
            <button
              title="Avatar upload (coming soon)"
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm"
              onClick={() => toast('Avatar upload coming in a future update 🙂', { icon: '📷' })}
            >
              <Camera size={13} />
            </button>
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{user?.name ?? 'Your Profile'}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                <AtSign size={11} />{user?.username ?? 'user'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                completeness >= 80
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : completeness >= 50
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {completeness >= 80 ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                {completeness >= 80 ? 'Profile complete' : 'Profile incomplete'}
              </span>
            </div>
          </div>

          {/* Completeness ring */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <CompletenessRing percent={completeness} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complete</p>
          </div>

          {/* Stats row */}
          {stats && (
            <div className="flex sm:flex-col gap-3 sm:gap-2 shrink-0">
              {[
                { label: 'Matches',    value: stats.total,      colour: 'text-indigo-600' },
                { label: 'Applied',    value: stats.applied,    colour: 'text-amber-600' },
                { label: 'Interviews', value: stats.interviews, colour: 'text-violet-600' },
                { label: 'Offers',     value: stats.offers,     colour: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-lg font-black ${s.colour}`}>{s.value}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completeness checklist */}
        {completeness < 100 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-500 mb-3">Complete your profile to get better job matches:</p>
            <div className="flex flex-wrap gap-2">
              {completenessChecks.filter(c => !c.done).map(c => (
                <span key={c.label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                  <AlertCircle size={11} />{c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Settings body: nav + content ── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* ── Left vertical tab nav ── */}
        <nav className="w-full md:w-56 shrink-0">
          {/* Mobile: horizontal scrolling tabs */}
          <div className="flex md:hidden gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                  activeTab === item.id
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {item.icon}{item.label}
              </button>
            ))}
          </div>

          {/* Desktop: vertical pill nav */}
          <div className="hidden md:flex flex-col gap-1 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={[
                  'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-left transition-all',
                  activeTab === item.id
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium',
                ].join(' ')}
              >
                <span className={activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">{item.desc}</div>
                </div>
                {activeTab === item.id && (
                  <ChevronRight size={14} className="ml-auto text-indigo-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Right content area ── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* ────────── PERSONAL INFO ────────── */}
            {activeTab === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm"
              >
                <SectionHead
                  title="Personal Information"
                  desc="Your identity details as set during sign-up. Contact support to update your name."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldRow label="Full Name" icon={<User size={12} />}>
                    <input
                      type="text"
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed"
                      value={user?.name ?? ''}
                      readOnly
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Name cannot be changed here. Contact support.</p>
                  </FieldRow>

                  <FieldRow label="Email" icon={<Mail size={12} />}>
                    <input
                      type="email"
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed"
                      value={user?.email ?? ''}
                      readOnly
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Email is your login identifier and cannot be changed.</p>
                  </FieldRow>

                  <FieldRow label="Username" icon={<AtSign size={12} />}>
                    <input
                      type="text"
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed"
                      value={user?.username ?? ''}
                      readOnly
                    />
                  </FieldRow>

                  <FieldRow label="Preferred Location" icon={<MapPin size={12} />}>
                    <select
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                    >
                      <option>Dublin</option>
                      <option>Remote</option>
                      <option>Hybrid</option>
                      <option>Other Ireland</option>
                    </select>
                  </FieldRow>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={savePreferences}
                    disabled={saving}
                    className="h-10 px-6 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ────────── CV MANAGEMENT ────────── */}
            {activeTab === 'cv' && (
              <motion.div
                key="cv"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Active CV card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead
                    title="CV / Resume"
                    desc="Your active CV is used by all 9 AI skills to tailor results specifically to you."
                  />

                  {profile?.activeCvFileName ? (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={22} className="text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{profile.activeCvFileName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Active document — used for all AI skills</p>
                      </div>
                      <button
                        onClick={downloadCv}
                        className="h-9 px-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold transition-all shrink-0"
                      >
                        <Download size={13} />Download
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">No CV uploaded yet</p>
                        <p className="text-xs text-amber-700 mt-0.5">Upload your CV below to unlock all 9 AI career skills.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload area */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead
                    title="Upload New CV"
                    desc="Replaces your current active CV. Accepts PDF or DOCX, max 5 MB."
                  />

                  <div
                    className={[
                      'relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group',
                      cvFile
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40',
                    ].join(' ')}
                    onClick={() => cvInputRef.current?.click()}
                  >
                    <input
                      ref={cvInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={e => setCvFile(e.target.files?.[0] ?? null)}
                    />
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                      <Upload size={22} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    {cvFile ? (
                      <>
                        <p className="font-bold text-indigo-700">{cvFile.name}</p>
                        <p className="text-xs text-indigo-500 mt-1">
                          {(cvFile.size / 1024 / 1024).toFixed(2)} MB — click Upload below to confirm
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-700">Click to select your CV</p>
                        <p className="text-sm text-slate-400 mt-1">or drag and drop here</p>
                        <p className="text-xs text-slate-300 mt-2">PDF or DOCX · Max 5 MB</p>
                      </>
                    )}
                  </div>

                  {cvFile && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setCvFile(null)}
                        className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:border-slate-300 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={uploadCv}
                        disabled={uploadingCv}
                        className="flex-1 h-10 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Upload size={14} />
                        {uploadingCv ? 'Uploading…' : 'Upload CV'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ────────── PREFERENCES ────────── */}
            {activeTab === 'preferences' && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm"
              >
                <SectionHead
                  title="Job Matching Preferences"
                  desc="Fine-tune how CareerOps scores and surfaces opportunities for you."
                />

                <div className="space-y-6">

                  {/* Target roles */}
                  <FieldRow label="Target Roles" icon={<Target size={12} />} hint="Press Enter or comma to add a role">
                    <TagInput value={targetRoles} onChange={setTargetRoles} placeholder="e.g. Senior Frontend Engineer" />
                  </FieldRow>

                  {/* Tech stack */}
                  <FieldRow label="Tech Stack" icon={<Zap size={12} />} hint="Add the technologies you work with">
                    <TagInput value={techStack} onChange={setTechStack} placeholder="e.g. React, TypeScript, Node.js" />
                  </FieldRow>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Salary */}
                    <FieldRow label="Salary Expectation" icon={<Euro size={12} />}>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                          <input
                            type="number" min={0} step={5000}
                            className="w-full pl-7 pr-3 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={salaryMin}
                            onChange={e => setSalaryMin(+e.target.value)}
                          />
                        </div>
                        <span className="text-slate-300 font-bold text-sm">to</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                          <input
                            type="number" min={0} step={5000}
                            className="w-full pl-7 pr-3 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            value={salaryMax}
                            onChange={e => setSalaryMax(+e.target.value)}
                          />
                        </div>
                      </div>
                    </FieldRow>

                    {/* Sponsorship */}
                    <FieldRow label="Visa Sponsorship" icon={<ShieldCheck size={12} />}>
                      <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setSponsorship(true)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            sponsorship ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Required
                        </button>
                        <button
                          type="button"
                          onClick={() => setSponsorship(false)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                            !sponsorship ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Not Needed
                        </button>
                      </div>
                    </FieldRow>

                    {/* Freshness */}
                    <FieldRow label="Job Freshness Window" icon={<Clock size={12} />} hint="Only show jobs posted within this window">
                      <div className="grid grid-cols-4 gap-2">
                        {[24, 48, 72, 96].map(h => (
                          <button
                            key={h} type="button"
                            onClick={() => setFreshness(h)}
                            className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                              freshness === h
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                    </FieldRow>

                  </div>

                  {/* Min match slider */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        Minimum Match Quality
                      </label>
                      <span className="text-sm font-black text-indigo-600">{minMatch}%</span>
                    </div>
                    <input
                      type="range" min={50} max={90} step={5}
                      value={minMatch}
                      onChange={e => setMinMatch(+e.target.value)}
                      className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      <span>Relaxed (50%)</span>
                      <span>Balanced (70%)</span>
                      <span>Strict (90%)</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={savePreferences}
                      disabled={saving}
                      className="h-10 px-8 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {saving ? 'Saving…' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ────────── ACCOUNT ────────── */}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Password */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead
                    title="Password & Security"
                    desc="Manage your login credentials and account security."
                  />

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
                        <Lock size={18} className="text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">Change Password</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          For security, CareerOps uses an OTP-based reset flow. Click below to receive a secure
                          reset link on your registered email address.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setPwMode(m => !m)}
                      className="mt-4 h-9 px-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold transition-all"
                    >
                      {pwMode ? 'Hide instructions' : 'Show instructions'}
                    </button>

                    <AnimatePresence>
                      {pwMode && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <ol className="space-y-2 text-xs text-slate-600">
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                Go to the{' '}
                                <a href="/forgot-password" className="text-indigo-600 font-bold hover:underline">Forgot Password</a>
                                {' '}page
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                                Enter your registered email to receive an OTP
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                                Enter the OTP and choose your new password
                              </li>
                            </ol>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Danger zone */}
                <div className="bg-white border border-rose-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead
                    title="Danger Zone"
                    desc="Irreversible actions. Please read carefully before proceeding."
                  />
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-4">
                    <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-rose-800 text-sm">Delete Account</p>
                      <p className="text-xs text-rose-600 mt-1">
                        Permanently deletes your account, all matched jobs, skill results, and profile data.
                        This action cannot be undone.
                      </p>
                      <button
                        onClick={() => toast.error('Account deletion coming in a future update. Contact support to proceed.')}
                        className="mt-3 h-8 px-4 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition-all"
                      >
                        Delete My Account
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
