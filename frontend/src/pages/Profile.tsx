import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { profileApi } from '@/services/api';
import { ImportSummary, Portfolio Item, Profile, Stats } from '@/types';
import { useAuth } from '@/context/AuthContext';
import TagInput from '@/components/ui/TagInput';
import {
  User, Settings, FileText, Download, Upload, Lock, Euro, MapPin,
  Target, Zap, Clock, ShieldCheck, ChevronRight, CheckCircle2,
  AlertCircle, Camera, Mail, AtSign, Briefcase, Globe, Linkedin,
  Plus, Pencil, Trash2, ExternalLink, X, Loader2, FolderOpen,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────────
type ProfileTab = 'personal' | 'cv' | 'preferences' | 'portfolio' | 'goals' | 'linkedin' | 'account';

const NAV_ITEMS: { id: ProfileTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'personal',   label: 'Personal Info',    icon: <User size={16} />,       desc: 'Name, email, location' },
  { id: 'cv',         label: 'CV Management',    icon: <FileText size={16} />,   desc: 'Upload and manage your CV' },
  { id: 'preferences',label: 'Preferences',      icon: <Settings size={16} />,   desc: 'Job matching settings' },
  { id: 'portfolio',  label: 'Portfolio',         icon: <FolderOpen size={16} />, desc: 'Showcase your projects' },
  { id: 'goals',      label: 'Career Goals',      icon: <Target size={16} />,     desc: 'Target role and salary' },
  { id: 'linkedin',   label: 'LinkedIn Import',   icon: <Linkedin size={16} />,   desc: 'Import your LinkedIn data' },
  { id: 'account',    label: 'Account',           icon: <Lock size={16} />,       desc: 'Password and security' },
];

// ── Completeness ring ────────────────────────────────────────────────────────────
function CompletenessRing({ percent }: { percent: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  const colour = percent >= 80 ? '#10B981' : percent >= 50 ? '#6366F1' : '#F59E0B';
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={colour} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-slate-800">{percent}%</span>
      </div>
    </div>
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6 pb-5 border-b border-slate-100">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
    </div>
  );
}

function FieldRow({ label, hint, icon, children }: {
  label: string; hint?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {icon && <span className="text-slate-400">{icon}</span>}{label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ── Import Summary Modal ───────────────────────────────────────────────────────
function ImportSummaryModal({ summary, onClose }: { summary: ImportSummary; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Linkedin size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">LinkedIn Import Complete</h2>
            <p className="text-xs text-slate-400">Here’s what was imported into your profile</p>
          </div>
        </div>

        {/* Name / headline */}
        {(summary.firstName || summary.headline) && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <p className="font-bold text-slate-800 text-sm">
              {summary.firstName} {summary.lastName}
            </p>
            {summary.headline && (
              <p className="text-xs text-slate-500 mt-0.5">{summary.headline}</p>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Positions imported', value: summary.positionsImported, icon: <Briefcase size={14} />, colour: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            { label: 'Skills imported',    value: summary.skillsImported,    icon: <Zap size={14} />,      colour: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border ${s.colour}`}>
              {s.icon}
              <div>
                <div className="text-lg font-black">{s.value}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* What was updated */}
        <div className="space-y-2 mb-5">
          {[
            { label: 'Tech stack updated',    done: summary.techStackUpdated },
            { label: 'Target roles updated',  done: summary.targetRolesUpdated },
            { label: 'Location updated',      done: summary.locationUpdated },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2 text-sm">
              {r.done
                ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                : <div className="w-[15px] h-[15px] rounded-full border-2 border-slate-200 shrink-0" />}
              <span className={r.done ? 'text-slate-700 font-medium' : 'text-slate-400'}>{r.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full h-10 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
        >
          Done
        </button>
      </motion.div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab]     = useState<ProfileTab>('personal');
  const [profile, setProfile]         = useState<Profile | null>(null);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [saving, setSaving]           = useState(false);
  const [cvFile, setCvFile]           = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [pwMode, setPwMode]           = useState(false);
  const cvInputRef                    = useRef<HTMLInputElement>(null);

  // ─ Preferences state
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [techStack, setTechStack]     = useState<string[]>([]);
  const [location, setLocation]       = useState('Dublin');
  const [salaryMin, setSalaryMin]     = useState(50000);
  const [salaryMax, setSalaryMax]     = useState(110000);
  const [sponsorship, setSponsorship] = useState(false);
  const [freshness, setFreshness]     = useState(96);
  const [minMatch, setMinMatch]       = useState(60);

  // ─ Career Goals state
  const [goalTitle, setGoalTitle]         = useState('');
  const [goalSalaryMin, setGoalSalaryMin] = useState(60000);
  const [goalSalaryMax, setGoalSalaryMax] = useState(120000);
  const [goalLocation, setGoalLocation]   = useState('');
  const [openToRemote, setOpenToRemote]   = useState(true);
  const [savingGoals, setSavingGoals]     = useState(false);

  // ─ Portfolio state
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioModal, setPortfolioModal] = useState<
    | { mode: 'add' }
    | { mode: 'edit'; item: PortfolioItem }
    | null
  >(null);

  // ─ LinkedIn import state
  const [linkedinFile, setLinkedinFile]         = useState<File | null>(null);
  const [importing, setImporting]               = useState(false);
  const [importSummary, setImportSummary]       = useState<ImportSummary | null>(null);
  const linkedinInputRef                        = useRef<HTMLInputElement>(null);

  // ── Load on mount
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
        setPortfolioItems(p.portfolioItems || []);
        setGoalTitle(p.goalTitle || '');
        setGoalSalaryMin(p.goalSalaryMin || 60000);
        setGoalSalaryMax(p.goalSalaryMax || 120000);
        setGoalLocation(p.goalLocation || '');
        setOpenToRemote(p.openToRemote ?? true);
      })
      .catch(() => toast.error('Failed to load profile'));
  }, []);

  // ── Completeness (driven by server score when available, fallback local)
  const completeness = profile?.completenessScore ?? 0;

  const completenessChecks = [
    { label: 'CV uploaded',        done: !!profile?.activeCvFileName },
    { label: 'Target roles set',   done: targetRoles.length > 0 },
    { label: 'Tech stack added',   done: techStack.length > 0 },
    { label: 'Location set',       done: !!location },
    { label: 'Portfolio project',  done: portfolioItems.length > 0 },
    { label: 'Career goal set',    done: !!goalTitle && goalSalaryMin > 0 && goalSalaryMax > 0 },
  ];

  // ── Handlers
  async function savePreferences() {
    setSaving(true);
    try {
      const p = await profileApi.update({
        targetRoles, techStack, location,
        salaryMin, salaryMax,
        sponsorshipRequired: sponsorship,
        freshnessHours: freshness,
        minMatchPercent: minMatch,
      });
      setProfile(p);
      toast.success('Preferences saved');
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveGoals() {
    setSavingGoals(true);
    try {
      const p = await profileApi.update({
        goalTitle, goalSalaryMin, goalSalaryMax,
        goalLocation: goalLocation || null,
        openToRemote,
      });
      setProfile(p);
      toast.success('Career goals saved');
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Save failed');
    } finally {
      setSavingGoals(false);
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
    } catch { toast.error('Download failed'); }
  }

  async function importLinkedIn() {
    if (!linkedinFile) return;
    setImporting(true);
    const toastId = toast.loading('Importing your LinkedIn data…');
    try {
      const summary = await profileApi.importLinkedIn(linkedinFile);
      toast.dismiss(toastId);
      toast.success('LinkedIn import complete!');
      setImportSummary(summary);
      setLinkedinFile(null);
      // Refresh profile to reflect merged data
      const p = await profileApi.get();
      setProfile(p);
      setTechStack(p.techStack || []);
      setTargetRoles(p.targetRoles || []);
      if (p.location) setLocation(p.location);
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e.normalizedMessage || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const initials = user?.name
    ?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';

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

      {/* ── Settings body ── */}
      <div className="flex flex-col md:flex-row gap-6 items-start">

        {/* Left nav */}
        <nav className="w-full md:w-56 shrink-0">
          <div className="flex md:hidden gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0',
                  activeTab === item.id ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}>
                {item.icon}{item.label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex flex-col gap-1 bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={[
                  'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm text-left transition-all',
                  activeTab === item.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium',
                ].join(' ')}>
                <span className={activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'}>{item.icon}</span>
                <div className="min-w-0">
                  <div className="truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">{item.desc}</div>
                </div>
                {activeTab === item.id && <ChevronRight size={14} className="ml-auto text-indigo-400 shrink-0" />}
              </button>
            ))}
          </div>
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* ────────── PERSONAL INFO ────────── */}
            {activeTab === 'personal' && (
              <motion.div key="personal" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <SectionHead title="Personal Information"
                  desc="Your identity details as set during sign-up. Contact support to update your name." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldRow label="Full Name" icon={<User size={12} />}>
                    <input type="text"
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed"
                      value={user?.name ?? ''} readOnly />
                    <p className="text-[11px] text-slate-400 mt-1">Name cannot be changed here. Contact support.</p>
                  </FieldRow>
                  <FieldRow label="Email" icon={<Mail size={12} />}>
                    <input type="email"
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed"
                      value={user?.email ?? ''} readOnly />
                    <p className="text-[11px] text-slate-400 mt-1">Email is your login identifier and cannot be changed.</p>
                  </FieldRow>
                  <FieldRow label="Username" icon={<AtSign size={12} />}>
                    <input type="text"
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed"
                      value={user?.username ?? ''} readOnly />
                  </FieldRow>
                  <FieldRow label="Preferred Location" icon={<MapPin size={12} />}>
                    <select
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={location} onChange={e => setLocation(e.target.value)}>
                      <option>Dublin</option><option>Remote</option>
                      <option>Hybrid</option><option>Other Ireland</option>
                    </select>
                  </FieldRow>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={savePreferences} disabled={saving}
                    className="h-10 px-6 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ────────── CV MANAGEMENT ────────── */}
            {activeTab === 'cv' && (
              <motion.div key="cv" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead title="CV / Resume"
                    desc="Your active CV is used by all AI skills to tailor results specifically to you." />
                  {profile?.activeCvFileName ? (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="w-12 h-12 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={22} className="text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800 truncate">{profile.activeCvFileName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Active document — used for all AI skills</p>
                      </div>
                      <button onClick={downloadCv}
                        className="h-9 px-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold transition-all shrink-0">
                        <Download size={13} />Download
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">No CV uploaded yet</p>
                        <p className="text-xs text-amber-700 mt-0.5">Upload your CV below to unlock all AI career skills.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead title="Upload New CV" desc="Accepts PDF or DOCX, max 5 MB." />
                  <div
                    className={['relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group',
                      cvFile ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40',
                    ].join(' ')}
                    onClick={() => cvInputRef.current?.click()}>
                    <input ref={cvInputRef} type="file" accept=".pdf,.docx" className="hidden"
                      onChange={e => setCvFile(e.target.files?.[0] ?? null)} />
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                      <Upload size={22} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    {cvFile ? (
                      <><p className="font-bold text-indigo-700">{cvFile.name}</p>
                        <p className="text-xs text-indigo-500 mt-1">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</p></>
                    ) : (
                      <><p className="font-semibold text-slate-700">Click to select your CV</p>
                        <p className="text-sm text-slate-400 mt-1">or drag and drop here</p>
                        <p className="text-xs text-slate-300 mt-2">PDF or DOCX · Max 5 MB</p></>
                    )}
                  </div>
                  {cvFile && (
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setCvFile(null)}
                        className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:border-slate-300 transition-all">Cancel</button>
                      <button onClick={uploadCv} disabled={uploadingCv}
                        className="flex-1 h-10 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        <Upload size={14} />{uploadingCv ? 'Uploading…' : 'Upload CV'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ────────── PREFERENCES ────────── */}
            {activeTab === 'preferences' && (
              <motion.div key="preferences" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <SectionHead title="Job Matching Preferences"
                  desc="Fine-tune how CareerOps scores and surfaces opportunities for you." />
                <div className="space-y-6">
                  <FieldRow label="Target Roles" icon={<Target size={12} />} hint="Press Enter or comma to add a role">
                    <TagInput value={targetRoles} onChange={setTargetRoles} placeholder="e.g. Senior Frontend Engineer" />
                  </FieldRow>
                  <FieldRow label="Tech Stack" icon={<Zap size={12} />} hint="Add the technologies you work with">
                    <TagInput value={techStack} onChange={setTechStack} placeholder="e.g. React, TypeScript, Node.js" />
                  </FieldRow>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FieldRow label="Salary Expectation" icon={<Euro size={12} />}>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                          <input type="number" min={0} step={5000}
                            className="w-full pl-7 pr-3 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={salaryMin} onChange={e => setSalaryMin(+e.target.value)} />
                        </div>
                        <span className="text-slate-300 font-bold text-sm">to</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                          <input type="number" min={0} step={5000}
                            className="w-full pl-7 pr-3 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={salaryMax} onChange={e => setSalaryMax(+e.target.value)} />
                        </div>
                      </div>
                    </FieldRow>
                    <FieldRow label="Visa Sponsorship" icon={<ShieldCheck size={12} />}>
                      <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button type="button" onClick={() => setSponsorship(true)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${sponsorship ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Required</button>
                        <button type="button" onClick={() => setSponsorship(false)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!sponsorship ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Not Needed</button>
                      </div>
                    </FieldRow>
                    <FieldRow label="Job Freshness Window" icon={<Clock size={12} />} hint="Only show jobs posted within this window">
                      <div className="grid grid-cols-4 gap-2">
                        {[24, 48, 72, 96].map(h => (
                          <button key={h} type="button" onClick={() => setFreshness(h)}
                            className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                              freshness === h ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                            }`}>{h}h</button>
                        ))}
                      </div>
                    </FieldRow>
                  </div>
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Minimum Match Quality</label>
                      <span className="text-sm font-black text-indigo-600">{minMatch}%</span>
                    </div>
                    <input type="range" min={50} max={90} step={5} value={minMatch}
                      onChange={e => setMinMatch(+e.target.value)}
                      className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      <span>Relaxed (50%)</span><span>Balanced (70%)</span><span>Strict (90%)</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={savePreferences} disabled={saving}
                      className="h-10 px-8 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
                      {saving ? 'Saving…' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ────────── PORTFOLIO ────────── */}
            {activeTab === 'portfolio' && (
              <motion.div key="portfolio" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-4">

                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6 pb-5 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Portfolio Projects</h3>
                      <p className="text-sm text-slate-400 mt-0.5">Showcase work that AI skills can reference when tailoring your applications.</p>
                    </div>
                    <button
                      onClick={() => setPortfolioModal({ mode: 'add' })}
                      className="h-9 px-4 flex items-center gap-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shrink-0">
                      <Plus size={13} />Add Project
                    </button>
                  </div>

                  {portfolioItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <FolderOpen size={24} className="text-slate-400" />
                      </div>
                      <p className="font-bold text-slate-700 text-sm">Add your first project</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">Projects help CareerOps AI highlight your practical experience in cover letters and outreach messages.</p>
                      <button
                        onClick={() => setPortfolioModal({ mode: 'add' })}
                        className="mt-5 h-9 px-5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all">
                        + Add Project
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {portfolioItems.map(item => (
                        <PortfolioCard
                          key={item.id}
                          item={item}
                          onEdit={() => setPortfolioModal({ mode: 'edit', item })}
                          onDelete={async () => {
                            try {
                              const p = await profileApi.deletePortfolioItem(item.id);
                              setPortfolioItems(p.portfolioItems || []);
                              setProfile(p);
                              toast.success('Project removed');
                            } catch (e: any) {
                              toast.error(e.normalizedMessage || 'Delete failed');
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Portfolio modal */}
                <AnimatePresence>
                  {portfolioModal && (
                    <PortfolioFormModal
                      mode={portfolioModal.mode}
                      initialItem={portfolioModal.mode === 'edit' ? portfolioModal.item : undefined}
                      onClose={() => setPortfolioModal(null)}
                      onSave={async (data) => {
                        try {
                          let p: Profile;
                          if (portfolioModal.mode === 'add') {
                            p = await profileApi.addPortfolioItem(data);
                          } else {
                            p = await profileApi.updatePortfolioItem((portfolioModal as any).item.id, data);
                          }
                          setPortfolioItems(p.portfolioItems || []);
                          setProfile(p);
                          setPortfolioModal(null);
                          toast.success(portfolioModal.mode === 'add' ? 'Project added!' : 'Project updated!');
                        } catch (e: any) {
                          toast.error(e.normalizedMessage || 'Save failed');
                        }
                      }}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ────────── CAREER GOALS ────────── */}
            {activeTab === 'goals' && (
              <motion.div key="goals" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <SectionHead title="Career Goals"
                  desc="Define your target role and salary so CareerOps can prioritise the most relevant opportunities." />

                <div className="space-y-6">
                  {/* Target role */}
                  <FieldRow label="Target Role Title" icon={<Briefcase size={12} />}
                    hint="E.g. Senior Full-Stack Engineer, Engineering Manager">
                    <input type="text" maxLength={200}
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Senior Full-Stack Engineer"
                      value={goalTitle} onChange={e => setGoalTitle(e.target.value)} />
                  </FieldRow>

                  {/* Salary range slider */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Euro size={12} className="text-slate-400" />Goal Salary Range
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-medium mb-1">Minimum</div>
                          <div className="text-lg font-black text-slate-800">€{(goalSalaryMin / 1000).toFixed(0)}k</div>
                        </div>
                        <div className="text-slate-300 font-bold">↔</div>
                        <div className="text-center">
                          <div className="text-xs text-slate-400 font-medium mb-1">Maximum</div>
                          <div className="text-lg font-black text-emerald-600">€{(goalSalaryMax / 1000).toFixed(0)}k</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Min (€20k–€200k)</span>
                            <span className="font-bold text-slate-600">€{(goalSalaryMin / 1000).toFixed(0)}k</span>
                          </div>
                          <input type="range" min={20000} max={200000} step={5000}
                            value={goalSalaryMin}
                            onChange={e => {
                              const v = +e.target.value;
                              setGoalSalaryMin(v);
                              if (v >= goalSalaryMax) setGoalSalaryMax(Math.min(v + 10000, 200000));
                            }}
                            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Max (€20k–€200k)</span>
                            <span className="font-bold text-emerald-600">€{(goalSalaryMax / 1000).toFixed(0)}k</span>
                          </div>
                          <input type="range" min={20000} max={200000} step={5000}
                            value={goalSalaryMax}
                            onChange={e => {
                              const v = +e.target.value;
                              setGoalSalaryMax(v);
                              if (v <= goalSalaryMin) setGoalSalaryMin(Math.max(v - 10000, 20000));
                            }}
                            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preferred location */}
                  <FieldRow label="Preferred Goal Location" icon={<MapPin size={12} />}
                    hint="Leave blank to use your general preferred location">
                    <input type="text" maxLength={100}
                      className="w-full px-4 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Dublin, London, Amsterdam"
                      value={goalLocation} onChange={e => setGoalLocation(e.target.value)} />
                  </FieldRow>

                  {/* Remote toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                        <Globe size={16} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Open to Remote</p>
                        <p className="text-xs text-slate-400">Include fully-remote roles in your matches</p>
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => setOpenToRemote(r => !r)}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                        openToRemote ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        openToRemote ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={saveGoals} disabled={savingGoals}
                      className="h-10 px-8 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2">
                      {savingGoals ? 'Saving…' : 'Save Career Goals'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ────────── LINKEDIN IMPORT ────────── */}
            {activeTab === 'linkedin' && (
              <motion.div key="linkedin" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-5">

                {/* How to export */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                    <Linkedin size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-blue-900 text-sm">How to get your LinkedIn data export</p>
                    <ol className="mt-2 space-y-1 text-xs text-blue-700 list-decimal list-inside">
                      <li>Go to <strong>LinkedIn → Settings &amp; Privacy → Data Privacy</strong></li>
                      <li>Click <strong>“Get a copy of your data”</strong></li>
                      <li>Select <strong>Profile, Positions, Skills</strong> and request the archive</li>
                      <li>LinkedIn emails you a ZIP file (usually within a few minutes)</li>
                      <li>Upload that ZIP file below</li>
                    </ol>
                  </div>
                </div>

                {/* Upload area */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead title="Upload LinkedIn Export ZIP"
                    desc="We’ll import your positions as target roles and your skills as tech stack — without overwriting existing data." />

                  <div
                    className={['relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all group',
                      linkedinFile
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/40',
                    ].join(' ')}
                    onClick={() => !importing && linkedinInputRef.current?.click()}>
                    <input ref={linkedinInputRef} type="file" accept=".zip" className="hidden"
                      onChange={e => setLinkedinFile(e.target.files?.[0] ?? null)} />
                    <div className="w-12 h-12 bg-slate-100 group-hover:bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                      {importing
                        ? <Loader2 size={22} className="text-blue-500 animate-spin" />
                        : <Linkedin size={22} className="text-slate-400 group-hover:text-blue-500 transition-colors" />}
                    </div>
                    {linkedinFile ? (
                      <><p className="font-bold text-blue-700">{linkedinFile.name}</p>
                        <p className="text-xs text-blue-500 mt-1">{(linkedinFile.size / 1024 / 1024).toFixed(2)} MB · ZIP file</p></>
                    ) : (
                      <><p className="font-semibold text-slate-700">Click to select your LinkedIn ZIP</p>
                        <p className="text-sm text-slate-400 mt-1">or drag and drop here</p>
                        <p className="text-xs text-slate-300 mt-2">ZIP only · Max 20 MB</p></>
                    )}
                  </div>

                  {linkedinFile && !importing && (
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => setLinkedinFile(null)}
                        className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:border-slate-300 transition-all">Cancel</button>
                      <button onClick={importLinkedIn}
                        className="flex-1 h-10 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                        <Linkedin size={14} />Import LinkedIn Data
                      </button>
                    </div>
                  )}
                </div>

                {/* Import Summary Modal */}
                <AnimatePresence>
                  {importSummary && (
                    <ImportSummaryModal
                      summary={importSummary}
                      onClose={() => setImportSummary(null)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ────────── ACCOUNT ────────── */}
            {activeTab === 'account' && (
              <motion.div key="account" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }} className="space-y-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead title="Password & Security" desc="Manage your login credentials and account security." />
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
                        <Lock size={18} className="text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">Change Password</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          For security, CareerOps uses an OTP-based reset flow.
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setPwMode(m => !m)}
                      className="mt-4 h-9 px-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-xs font-bold transition-all">
                      {pwMode ? 'Hide instructions' : 'Show instructions'}
                    </button>
                    <AnimatePresence>
                      {pwMode && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="mt-4 pt-4 border-t border-slate-200">
                            <ol className="space-y-2 text-xs text-slate-600">
                              <li className="flex items-start gap-2">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                                Go to the <a href="/forgot-password" className="text-indigo-600 font-bold hover:underline">Forgot Password</a> page
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
                <div className="bg-white border border-rose-200 rounded-2xl p-6 md:p-8 shadow-sm">
                  <SectionHead title="Danger Zone" desc="Irreversible actions. Please read carefully before proceeding." />
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-4">
                    <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-rose-800 text-sm">Delete Account</p>
                      <p className="text-xs text-rose-600 mt-1">Permanently deletes your account, all matched jobs, skill results, and profile data. This action cannot be undone.</p>
                      <button
                        onClick={() => toast.error('Account deletion coming in a future update. Contact support to proceed.')}
                        className="mt-3 h-8 px-4 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700 transition-all">
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

// ── Portfolio Card ───────────────────────────────────────────────────────────────
function PortfolioCard({ item, onEdit, onDelete }: {
  item: PortfolioItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <FolderOpen size={16} className="text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-800 truncate">{item.title}</p>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 font-medium mt-0.5">
                <ExternalLink size={10} />{item.url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
              <Pencil size={12} />
            </button>
            <button onClick={onDelete}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {item.description && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.description}</p>
        )}
        {item.techTags && item.techTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.techTags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-[10px] font-semibold">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portfolio Form Modal ──────────────────────────────────────────────────────
function PortfolioFormModal({ mode, initialItem, onClose, onSave }: {
  mode: 'add' | 'edit';
  initialItem?: PortfolioItem;
  onClose: () => void;
  onSave: (data: { title: string; url?: string; description?: string; techTags?: string[] }) => Promise<void>;
}) {
  const [title, setTitle]           = useState(initialItem?.title || '');
  const [url, setUrl]               = useState(initialItem?.url || '');
  const [description, setDesc]      = useState(initialItem?.description || '');
  const [techTags, setTechTags]     = useState<string[]>(initialItem?.techTags || []);
  const [saving, setSaving]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        url: url.trim() || undefined,
        description: description.trim() || undefined,
        techTags: techTags.length > 0 ? techTags : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X size={18} />
        </button>
        <h2 className="text-base font-bold text-slate-900 mb-5">
          {mode === 'add' ? '+ Add Project' : 'Edit Project'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldRow label="Project Title" icon={<FolderOpen size={12} />}>
            <input type="text" maxLength={200} required
              className="w-full px-4 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. CareerOps Platform"
              value={title} onChange={e => setTitle(e.target.value)} />
          </FieldRow>
          <FieldRow label="Project URL" icon={<Globe size={12} />}>
            <input type="url"
              className="w-full px-4 h-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://github.com/you/project"
              value={url} onChange={e => setUrl(e.target.value)} />
          </FieldRow>
          <FieldRow label="Description">
            <textarea rows={3} maxLength={500}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Brief description of what you built and your role…"
              value={description} onChange={e => setDesc(e.target.value)} />
          </FieldRow>
          <FieldRow label="Tech Tags" hint="Press Enter or comma to add">
            <TagInput value={techTags} onChange={setTechTags} placeholder="e.g. React, Node.js, PostgreSQL" />
          </FieldRow>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-500 text-sm font-semibold hover:border-slate-300 transition-all">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 h-10 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : mode === 'add' ? 'Add Project' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
