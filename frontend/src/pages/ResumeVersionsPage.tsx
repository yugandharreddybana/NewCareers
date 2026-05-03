import React, { useEffect, useRef, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { resumeVersionsApi, type ResumeVersion } from '@/services/resumeVersionsApi';
import { useFileUpload } from '@/hooks/useFileUpload';
import * as mocks from '@/services/mockApi';
import toast from 'react-hot-toast';
import { FileText, Upload, Star, Trash2, CheckCircle, Plus, BarChart2, ExternalLink, Award, X, AlertCircle } from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_VERSIONS: ResumeVersion[] = [
  { id: 'rv-1', label: 'Senior FE — Fintech Focus', targetRole: 'Senior Frontend Engineer', fileUrl: null, content: null, isActive: true,  createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), outcome: 'interview',  applicationCount: 5 },
  { id: 'rv-2', label: 'Fullstack — General',       targetRole: 'Full Stack Developer',      fileUrl: null, content: null, isActive: false, createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), outcome: 'unknown',   applicationCount: 3 },
  { id: 'rv-3', label: 'Tech Lead Variant',          targetRole: 'Tech Lead',                 fileUrl: null, content: null, isActive: false, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), outcome: null,        applicationCount: 1 },
];

const OUTCOME_STYLES: Record<string, string> = {
  interview: 'bg-indigo-100 text-indigo-700',
  offer:     'bg-emerald-100 text-emerald-700',
  rejected:  'bg-red-100 text-red-600',
  unknown:   'bg-gray-100 text-gray-500',
};

// ── Upload Progress Bar ────────────────────────────────────────────────────────
const UploadProgressBar: React.FC<{ progress: number; onAbort: () => void }> = ({ progress, onAbort }) => (
  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs font-semibold text-indigo-700">Uploading… {progress}%</p>
      <button onClick={onAbort} title="Cancel upload"
        className="text-indigo-400 hover:text-red-500 transition-colors p-0.5 rounded">
        <X size={14} />
      </button>
    </div>
    <div className="w-full bg-indigo-100 rounded-full h-2 overflow-hidden">
      <div
        className="bg-indigo-500 h-2 rounded-full transition-all duration-200"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

const ResumeVersionsPage: React.FC = () => {
  const [versions, setVersions]     = useState<ResumeVersion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [recommendation, setRec]    = useState<{ recommendedId: string; reason: string } | null>(null);
  const [compareA, setCompareA]     = useState<string>('');
  const [compareB, setCompareB]     = useState<string>('');
  const [showOutcomeFor, setShowOutcomeFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { upload, progress, uploading, error, abort } = useFileUpload<ResumeVersion>({
    uploader: USE_MOCKS
      ? async (file, onProgress) => {
          for (let p = 0; p <= 100; p += 20) {
            await new Promise(r => setTimeout(r, 120));
            onProgress(p);
          }
          return { id: `rv-${Date.now()}`, label: file.name.replace(/\.(pdf|docx)$/i, ''), targetRole: null, fileUrl: null, content: null, isActive: false, createdAt: new Date().toISOString(), outcome: null, applicationCount: 0 };
        }
      : (file, onProgress, controller) => {
          const label = file.name.replace(/\.(pdf|docx)$/i, '');
          return resumeVersionsApi.uploadWithProgress(file, label, undefined, onProgress, controller);
        },
    onSuccess: (v) => {
      setVersions(prev => [v, ...prev]);
      toast.success('Resume version uploaded!');
    },
    onError: () => toast.error('Upload failed.'),
  });

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(r => setTimeout(r, 500));
          setVersions(MOCK_VERSIONS);
        } else {
          const d = await resumeVersionsApi.getAll().catch(() => MOCK_VERSIONS);
          setVersions(d);
          resumeVersionsApi.recommend().then(setRec).catch(() => {});
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleFilePick = (file: File) => {
    if (!file.name.match(/\.(pdf|docx)$/i)) { toast.error('PDF or DOCX only.'); return; }
    upload(file);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this version?')) return;
    setDeleting(id);
    try {
      if (!USE_MOCKS) await resumeVersionsApi.delete(id);
      setVersions(prev => prev.filter(v => v.id !== id));
      toast.success('Version deleted.');
    } catch { toast.error('Failed to delete.'); }
    finally { setDeleting(null); }
  };

  const handleSetOutcome = async (id: string, outcome: ResumeVersion['outcome']) => {
    try {
      if (!USE_MOCKS) await resumeVersionsApi.recordOutcome(id, outcome);
      setVersions(prev => prev.map(v => v.id === id ? { ...v, outcome } : v));
      setShowOutcomeFor(null);
      toast.success('Outcome recorded!');
    } catch { toast.error('Failed to record outcome.'); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading resume versions…</div>;

  return (
    <>
      <PageMeta title="Resume Versions — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Resume Versions</h1>
            <p className="text-sm text-gray-500 mt-1">Track multiple resume variants and their real-world outcomes.</p>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePick(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
              <Upload size={15} /> Upload Version
            </button>
          </div>
        </div>

        {/* Upload progress */}
        {uploading && progress !== null && (
          <UploadProgressBar progress={progress} onAbort={abort} />
        )}

        {/* Upload error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-700 flex-1">{error}</p>
          </div>
        )}

        {/* AI Recommendation */}
        {recommendation && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <Award size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">AI Recommendation</p>
              <p className="text-xs text-emerald-700 mt-0.5">{recommendation.reason}</p>
            </div>
          </div>
        )}

        {/* Compare tool */}
        {versions.length >= 2 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Compare Two Versions</p>
            <div className="flex gap-3 items-center">
              <select value={compareA} onChange={e => setCompareA(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                <option value="">Select version A</option>
                {versions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <span className="text-gray-400 text-sm">vs</span>
              <select value={compareB} onChange={e => setCompareB(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
                <option value="">Select version B</option>
                {versions.filter(v => v.id !== compareA).map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <button disabled={!compareA || !compareB} onClick={() => toast('Diff view coming soon!')}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors">
                Compare
              </button>
            </div>
          </div>
        )}

        {/* Version list */}
        <div className="space-y-3">
          {versions.map(v => (
            <div key={v.id} className={`bg-white border rounded-xl p-4 ${ v.isActive ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ v.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>
                  <FileText size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{v.label}</p>
                    {v.isActive && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full"><CheckCircle size={10} /> Active</span>}
                    {v.outcome && v.outcome !== 'unknown' && <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${OUTCOME_STYLES[v.outcome]}`}>{v.outcome}</span>}
                  </div>
                  {v.targetRole && <p className="text-xs text-gray-400 mt-0.5">Target: {v.targetRole}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{v.applicationCount} application{v.applicationCount !== 1 ? 's' : ''} · {new Date(v.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setShowOutcomeFor(showOutcomeFor === v.id ? null : v.id)} title="Record outcome"
                    className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"><BarChart2 size={14} /></button>
                  {!v.isActive && <button onClick={() => handleDelete(v.id)} disabled={deleting === v.id}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"><Trash2 size={14} /></button>}
                </div>
              </div>
              {showOutcomeFor === v.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                  <p className="text-xs text-gray-500 w-full">Record outcome for this version:</p>
                  {(['interview','offer','rejected','unknown'] as ResumeVersion['outcome'][]).map(o => (
                    <button key={o!} onClick={() => handleSetOutcome(v.id, o)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${ v.outcome === o ? 'bg-indigo-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {versions.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
            <FileText size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No versions yet. Upload your first resume to get started.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ResumeVersionsPage;
