import React, { useEffect, useRef, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { cvApi, type CvRecord } from '@/services/cvApi';
import { useFileUpload } from '@/hooks/useFileUpload';
import toast from 'react-hot-toast';
import {
  Upload, FileText, Download, Trash2, CheckCircle,
  Clock, Star, Plus, AlertCircle, X,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface CvVersion {
  id: string;
  name: string;
  uploadedAt: string;
  isActive: boolean;
  size?: string;
  source?: 'upload' | 'ai-generated';
}

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_VERSIONS: CvVersion[] = [
  { id: 'cv-1', name: 'Senior FE — Fintech Focus.pdf', uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(), isActive: true,  size: '124 KB', source: 'upload' },
  { id: 'cv-2', name: 'Fullstack — General.pdf',       uploadedAt: new Date(Date.now() - 86400000 * 7).toISOString(), isActive: false, size: '98 KB',  source: 'upload' },
  { id: 'cv-3', name: 'TechWave Tailored (AI).pdf',    uploadedAt: new Date(Date.now() - 86400000 * 1).toISOString(), isActive: false, size: '131 KB', source: 'ai-generated' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function formatFileSize(sizeBytes: number | null): string | undefined {
  if (sizeBytes == null) return undefined;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toCvVersion(cv: CvRecord): CvVersion {
  const size = formatFileSize(cv.sizeBytes);
  return {
    id: cv.id,
    name: cv.name,
    uploadedAt: cv.createdAt,
    isActive: cv.isActive,
    source: 'upload',
    ...(size ? { size } : {}),
  };
}

// ── Version card ───────────────────────────────────────────────────────────────
const CvCard: React.FC<{
  cv: CvVersion;
  onSetActive: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string, name: string) => void;
  deleting: boolean;
}> = ({ cv, onSetActive, onDelete, onDownload, deleting }) => (
  <div className={`bg-white border rounded-xl p-4 flex items-start gap-4 transition-shadow hover:shadow-sm ${
    cv.isActive ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'
  }`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
      cv.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
    }`}>
      <FileText size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-900 truncate max-w-xs">{cv.name}</p>
        {cv.isActive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
            <CheckCircle size={10} /> Active
          </span>
        )}
        {cv.source === 'ai-generated' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">
            ✨ AI
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1 flex items-center gap-3">
        <span className="flex items-center gap-1"><Clock size={11} /> {relativeTime(cv.uploadedAt)}</span>
        {cv.size && <span>{cv.size}</span>}
      </p>
    </div>
    <div className="flex items-center gap-1 shrink-0">
      {!cv.isActive && (
        <button onClick={() => onSetActive(cv.id)} title="Set as active CV"
          className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <Star size={15} />
        </button>
      )}
      <button onClick={() => onDownload(cv.id, cv.name)} title="Download"
        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
        <Download size={15} />
      </button>
      {!cv.isActive && (
        <button onClick={() => onDelete(cv.id)} disabled={deleting} title="Delete"
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  </div>
);

// ── Tips ───────────────────────────────────────────────────────────────────────
const CV_TIPS = [
  'Keep your active CV to 1–2 pages for most roles.',
  'Use the AI Tailor Skill on the Job Detail page to generate a targeted CV version.',
  'Quantify your achievements — numbers stand out to ATS and recruiters.',
  'Mirror the language used in each job description wherever truthful.',
  'Save a plain-text copy alongside your PDF for ATS compatibility.',
];

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

// ── Main page ──────────────────────────────────────────────────────────────────
const CvManagerPage: React.FC = () => {
  const [versions, setVersions] = useState<CvVersion[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { upload, progress, uploading, error, abort } = useFileUpload<CvRecord>({
    uploader: USE_MOCKS
      ? async (file, onProgress) => {
          // Simulate progress in mock mode
          for (let p = 0; p <= 100; p += 20) {
            await new Promise(r => setTimeout(r, 120));
            onProgress(p);
          }
          return {
            id: `cv-${Date.now()}`,
            name: file.name,
            url: '',
            contentType: file.type || 'application/octet-stream',
            isActive: true,
            sizeBytes: file.size,
            createdAt: new Date().toISOString(),
          };
        }
      : (file, onProgress, signal) =>
          cvApi.uploadWithProgress(file, onProgress, signal),
    onSuccess: (res) => {
      const newCv = toCvVersion(res);
      setVersions(prev => [newCv, ...prev.filter(v => v.id !== newCv.id).map(v => ({ ...v, isActive: false }))]);
      toast.success('CV uploaded and set as active!');
    },
    onError: () => toast.error('Upload failed. Please try again.'),
  });

  useEffect(() => {
    if (USE_MOCKS) {
      setTimeout(() => { setVersions(MOCK_VERSIONS); setLoading(false); }, 500);
      return;
    }
    cvApi.list()
      .then(cvs => setVersions(cvs.map(toCvVersion)))
      .catch(() => toast.error('Failed to load CV data.'))
      .finally(() => setLoading(false));
  }, []);

  const handleFilePick = (file: File) => {
    if (!file.name.match(/\.(pdf|docx)$/i)) { toast.error('Only PDF and DOCX files are supported.'); return; }
    upload(file);
  };

  const handleSetActive = async (id: string) => {
    try {
      if (!USE_MOCKS) await cvApi.setActive(id);
      setVersions(prev => prev.map(v => ({ ...v, isActive: v.id === id })));
      toast.success('Active CV updated.');
    } catch {
      toast.error('Failed to update active CV.');
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      if (!USE_MOCKS) await cvApi.remove(id);
      setVersions(prev => prev.filter(v => v.id !== id));
      toast.success('CV version removed.');
    } catch { toast.error('Failed to delete CV.'); }
    finally { setDeleting(null); }
  };

  const handleDownload = async (_id: string, name: string) => {
    try {
      if (USE_MOCKS) { toast('Mock: download triggered for ' + name); return; }
      await cvApi.download(_id, name);
    } catch { toast.error('Download failed.'); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading CV Manager…</div>;

  return (
    <>
      <PageMeta title="CV Manager — CareerOps" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CV Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your CV versions. The <strong>Active</strong> version is used by all AI Skills.</p>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".pdf,.docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFilePick(f); e.target.value = ''; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={15} /> Upload CV
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
            <button onClick={() => {}} className="text-red-400 hover:text-red-600"><X size={13} /></button>
          </div>
        )}

        {/* Drop zone (hidden while uploading) */}
        {!uploading && (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFilePick(f); }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Drag &amp; drop your CV here, or <span className="text-indigo-500 font-medium">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">PDF or DOCX · Max 5 MB</p>
          </div>
        )}

        {/* Versions list */}
        {versions.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Your CV Versions ({versions.length})</h2>
            {versions.map(cv => (
              <CvCard key={cv.id} cv={cv} onSetActive={handleSetActive} onDelete={handleDelete} onDownload={handleDownload} deleting={deleting === cv.id} />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <AlertCircle size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No CVs uploaded yet. Upload your first CV to get started.</p>
          </div>
        )}

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">💡 CV Tips</h3>
          <ul className="space-y-2">
            {CV_TIPS.map((tip, i) => (
              <li key={i} className="text-xs text-blue-700 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
};

export default CvManagerPage;
