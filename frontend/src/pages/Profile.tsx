import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { profileApi } from '@/services/api';
import { Profile, Stats } from '@/types';
import { useAuth } from '@/context/AuthContext';
import TagInput from '@/components/ui/TagInput';
import { motion } from 'framer-motion';
import { 
  User, Settings, PieChart, FileText, Download, 
  Upload, ChevronRight, Lock, Euro, MapPin, 
  Target, Zap, Clock, ShieldCheck 
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [location, setLocation] = useState('Dublin');
  const [salaryMin, setSalaryMin] = useState(50000);
  const [salaryMax, setSalaryMax] = useState(110000);
  const [sponsorship, setSponsorship] = useState(false);
  const [freshness, setFreshness] = useState(96);
  const [minMatch, setMinMatch] = useState(60);

  const [pwMode, setPwMode] = useState(false);

  useEffect(() => {
    Promise.all([profileApi.get(), profileApi.stats()]).then(([p, s]) => {
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
    }).catch(() => toast.error('Failed to load profile'));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await profileApi.update({
        targetRoles, techStack, location,
        salaryMin, salaryMax, sponsorshipRequired: sponsorship,
        freshnessHours: freshness, minMatchPercent: minMatch
      });
      toast.success('Profile saved');
    } catch (e: any) { toast.error(e.normalizedMessage || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function uploadCv() {
    if (!cvFile) return;
    setUploadingCv(true);
    try {
      await profileApi.uploadCv(cvFile);
      const p = await profileApi.get();
      setProfile(p);
      setCvFile(null);
      toast.success('CV updated');
    } catch (e: any) { toast.error(e.normalizedMessage || 'Upload failed'); }
    finally { setUploadingCv(false); }
  }

  async function downloadCv() {
    try {
      const { url } = await profileApi.cvDownload();
      if (url) window.open(url, '_blank');
      else toast.error('No CV uploaded yet');
    } catch { toast.error('Download failed'); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your <span className="gradient-text">Profile</span></h1>
        <p className="text-slate-500 font-medium">Manage your career identity and preferences</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Identity & Stats */}
        <div className="space-y-8 lg:col-span-1">
          {/* Identity */}
          <section className="glass-card p-6 flex flex-col items-center text-center">
            <div className="relative group">
              <div className="w-24 h-24 rounded-3xl bg-brand-vibrant shadow-glow flex items-center justify-center text-white text-3xl font-black mb-4 group-hover:rotate-6 transition-transform">
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
            <p className="text-sm font-semibold text-brand-vibrant uppercase tracking-wider mb-4">@{user?.username}</p>
            <div className="w-full pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                <FileText size={14} />
                <span>{user?.email}</span>
              </div>
            </div>
          </section>

          {/* Stats */}
          {stats && (
            <section className="grid grid-cols-2 gap-4">
              {[
                { label: 'Matches', value: stats.total, icon: <Target size={14} />, color: 'text-brand-vibrant', bg: 'bg-brand-vibrant/10' },
                { label: 'Applied', value: stats.applied, icon: <Zap size={14} />, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Interviews', value: stats.interviews, icon: <Clock size={14} />, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Offers', value: stats.offers, icon: <ShieldCheck size={14} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map(s => (
                <div key={s.label} className="glass-card p-4 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} ${s.color} flex items-center justify-center mb-2`}>
                    {s.icon}
                  </div>
                  <div className="text-xl font-black text-slate-900">{s.value}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </section>
          )}

          {/* CV Management */}
          <section className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="text-brand-vibrant" size={18} />
              <h3 className="font-bold text-slate-900">CV / Resume</h3>
            </div>
            
            {profile?.activeCvFileName ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-rose-500">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs text-slate-700 truncate">{profile.activeCvFileName}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Active Document</div>
                  </div>
                </div>
                <button 
                  onClick={downloadCv}
                  className="btn btn-secondary w-full text-xs py-2 h-9 !rounded-lg"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            ) : (
              <div className="text-center py-4 px-2 border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs font-medium text-slate-400">No active CV found</p>
              </div>
            )}

            <div
              className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-brand-vibrant hover:bg-brand-vibrant/5 transition-all"
              onClick={() => cvInputRef.current?.click()}
            >
              <input ref={cvInputRef} type="file" accept=".pdf,.docx" className="hidden"
                onChange={e => setCvFile(e.target.files?.[0] || null)} />
              
              <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Upload className="text-slate-400 group-hover:text-brand-vibrant" size={20} />
              </div>
              
              {cvFile ? (
                <div className="text-xs font-bold text-brand-vibrant truncate">{cvFile.name}</div>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-700">Drop your CV here</p>
                  <p className="text-[10px] text-slate-400 mt-1">PDF or DOCX (Max 5MB)</p>
                </>
              )}
            </div>

            {cvFile && (
              <button 
                className="btn btn-primary w-full shadow-lg !rounded-xl" 
                disabled={uploadingCv} 
                onClick={uploadCv}
              >
                {uploadingCv ? 'Processing...' : 'Upload & Sync'}
              </button>
            )}
          </section>
        </div>

        {/* Right Column: Preferences */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-card p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-brand-vibrant/10 rounded-xl flex items-center justify-center text-brand-vibrant">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Search Preferences</h3>
                <p className="text-xs text-slate-400 font-medium">Fine-tune how we match you to opportunities</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    <Target size={14} />
                    Target Roles
                  </label>
                  <TagInput value={targetRoles} onChange={setTargetRoles} placeholder="e.g. Senior Frontend Engineer" />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    <Zap size={14} />
                    Tech Stack
                  </label>
                  <TagInput value={techStack} onChange={setTechStack} placeholder="e.g. React, TypeScript, Node.js" />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    <MapPin size={14} />
                    Preferred Location
                  </label>
                  <select className="input" value={location} onChange={e => setLocation(e.target.value)}>
                    <option>Dublin</option><option>Remote</option><option>Hybrid</option><option>Other Ireland</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    <Euro size={14} />
                    Salary Expectation
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                      <input type="number" className="input !pl-7" min={0} step={5000} value={salaryMin}
                        onChange={e => setSalaryMin(+e.target.value)} />
                    </div>
                    <span className="text-slate-300 font-bold">to</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                      <input type="number" className="input !pl-7" min={0} step={5000} value={salaryMax}
                        onChange={e => setSalaryMax(+e.target.value)} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    <ShieldCheck size={14} />
                    Visa Sponsorship
                  </label>
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${sponsorship ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      onClick={() => setSponsorship(true)}>
                      Required
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!sponsorship ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      onClick={() => setSponsorship(false)}>
                      Not Needed
                    </button>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                    <Clock size={14} />
                    Freshness Window
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[24, 48, 72, 96].map(h => (
                      <button key={h} type="button"
                        className={`py-2 text-xs font-bold rounded-lg border transition-all ${freshness === h ? 'bg-brand-vibrant border-brand-vibrant text-white shadow-glow' : 'bg-white border-slate-200 text-slate-400 hover:border-brand-vibrant/30'}`}
                        onClick={() => setFreshness(h)}>{h}h</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10">
              <label className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                <span>Minimum Match Quality</span>
                <span className="text-brand-vibrant font-black text-sm">{minMatch}%</span>
              </label>
              <input type="range" min={50} max={90} value={minMatch}
                onChange={e => setMinMatch(+e.target.value)} 
                className="w-full accent-brand-vibrant h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" 
              />
              <div className="flex justify-between mt-2 px-1 text-[10px] font-bold text-slate-300 uppercase">
                <span>Relaxed</span>
                <span>Balanced</span>
                <span>Strict</span>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-slate-100 flex justify-end">
              <button 
                className="btn btn-primary px-10 py-4 !rounded-2xl shadow-premium group" 
                disabled={saving} 
                onClick={save}
              >
                <span>{saving ? 'Saving...' : 'Update Preferences'}</span>
                <ChevronRight className="group-hover:translate-x-1 transition-transform" size={18} />
              </button>
            </div>
          </section>

          {/* Account Security */}
          <section className="glass-card p-6">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() => setPwMode(m => !m)}
            >
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                <Lock size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-700">Account Security</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Change your password and security settings</p>
              </div>
              <ChevronRight className={`text-slate-300 transition-transform ${pwMode ? 'rotate-90' : ''}`} size={20} />
            </button>
            
            {pwMode && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-6 pt-6 border-t border-slate-100 overflow-hidden"
              >
                <p className="text-xs font-medium text-slate-500 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  To ensure your security, we use an OTP-based password reset flow. 
                  Use the <a href="/forgot-password" className="text-brand-vibrant font-bold hover:underline">Forgot Password</a> page to trigger a secure reset.
                </p>
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
