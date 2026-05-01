/**
 * Task 143 — CV Manager page.
 *
 * Features:
 *  - List uploaded CVs with active indicator
 *  - Drag-and-drop upload zone (click or drop)
 *  - Upload progress bar
 *  - Set active toggle
 *  - Delete with confirmation
 *  - Download button
 *  - EmptyState when no CVs uploaded
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Trash2, CheckCircle2, Star,
  Download, Loader2, AlertCircle, X,
} from 'lucide-react';
import PageShell from '@/components/ui/PageShell';
import EmptyState from '@/components/ui/EmptyState';
import { cvApi, CvRecord } from '@/services/cvApi';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CvManager() {
  const [cvs,         setCvs]         = useState<CvRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [activatingId,setActivatingId]= useState<string | null>(null);
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setCvs(await cvApi.list());
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Failed to load CVs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(file: File) {
    if (!file.name.match(/\.(pdf|doc|docx)$/i)) {
      toast.error('Only PDF, DOC, or DOCX files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB');
      return;
    }
    setUploading(true);
    setUploadPct(0);
    // Fake progress bar — increments to 90% then jumps to 100 on success
    const interval = setInterval(() => {
      setUploadPct(p => (p < 88 ? p + Math.random() * 12 : p));
    }, 200);
    try {
      await cvApi.upload(file);
      clearInterval(interval);
      setUploadPct(100);
      toast.success(`${file.name} uploaded`);
      await load();
    } catch (e: any) {
      clearInterval(interval);
      toast.error(e.normalizedMessage || 'Upload failed');
    } finally {
      setTimeout(() => { setUploading(false); setUploadPct(0); }, 600);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleSetActive(id: string) {
    setActivatingId(id);
    try {
      await cvApi.setActive(id);
      setCvs(prev => prev.map(c => ({ ...c, isActive: c.id === id })));
      toast.success('Active CV updated');
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Failed to set active CV');
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await cvApi.remove(id);
      setCvs(prev => prev.filter(c => c.id !== id));
      toast.success('CV deleted');
    } catch (e: any) {
      toast.error(e.normalizedMessage || 'Failed to delete CV');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  const activeCV = cvs.find(c => c.isActive);

  return (
    <PageShell
      title="CV Manager"
      subtitle="Upload and manage your CVs — the active one is used in all AI skill runs"
      actions={
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 h-9 px-4 bg-emerald-500 hover:bg-emerald-600
                     text-white rounded-xl font-semibold text-sm transition-all
                     disabled:opacity-50 shadow-sm"
        >
          <Upload size={14} />
          Upload CV
        </button>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={onFileInput}
      />

      {/* ── Upload progress bar ── */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-200 rounded-2xl px-5 py-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-emerald-500" />
                Uploading CV…
              </span>
              <span className="text-xs font-bold text-emerald-600">{Math.round(uploadPct)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-2 bg-emerald-500 rounded-full"
                animate={{ width: `${uploadPct}%` }}
                transition={{ ease: 'easeOut', duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drag-and-drop zone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-2xl px-6 py-10 flex flex-col items-center',
          'cursor-pointer transition-all select-none',
          dragOver
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50',
        ].join(' ')}
      >
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Upload size={20} className={dragOver ? 'text-emerald-500' : 'text-slate-400'} />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {dragOver ? 'Drop to upload' : 'Drag & drop your CV here'}
        </p>
        <p className="text-xs text-slate-400 mt-1">PDF, DOC or DOCX · max 5 MB</p>
      </div>

      {/* ── CV list ── */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-20 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : cvs.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} className="text-slate-300" />}
          message="No CVs uploaded yet"
          description="Upload your CV above. The active CV is sent with every AI skill run."
          cta="Upload CV"
          onCta={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {cvs.map(cv => (
              <motion.div
                key={cv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={[
                  'bg-white border rounded-2xl px-5 py-4 flex items-center gap-4 transition-all',
                  cv.isActive
                    ? 'border-emerald-300 ring-1 ring-emerald-200'
                    : 'border-slate-200',
                ].join(' ')}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                 ${ cv.isActive ? 'bg-emerald-50' : 'bg-slate-50' }`}>
                  <FileText size={18} className={cv.isActive ? 'text-emerald-500' : 'text-slate-400'} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {cv.originalName || cv.name}
                    </p>
                    {cv.isActive && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full
                                       bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
                        <CheckCircle2 size={9} /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cv.sizeBytes ? formatBytes(cv.sizeBytes) : ''}
                    {cv.createdAt
                      ? `${cv.sizeBytes ? ' · ' : ''}Uploaded ${
                          new Date(cv.createdAt).toLocaleDateString('en-IE',
                            { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : ''}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Set active */}
                  {!cv.isActive && (
                    <button
                      onClick={() => handleSetActive(cv.id)}
                      disabled={activatingId === cv.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                                 border border-slate-200 text-xs font-semibold
                                 text-slate-600 hover:border-emerald-400
                                 hover:text-emerald-700 transition-all
                                 disabled:opacity-50"
                    >
                      {activatingId === cv.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Star size={11} />}
                      Set active
                    </button>
                  )}

                  {/* Download */}
                  <button
                    onClick={() => cvApi.download(cv.id, cv.originalName || cv.name)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400
                               hover:text-slate-700 transition-colors"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>

                  {/* Delete */}
                  {confirmId === cv.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-rose-600 font-semibold">Sure?</span>
                      <button
                        onClick={() => handleDelete(cv.id)}
                        disabled={deletingId === cv.id}
                        className="px-2.5 py-1 rounded-lg bg-rose-500 text-white
                                   text-xs font-bold hover:bg-rose-600 transition-all
                                   disabled:opacity-50"
                      >
                        {deletingId === cv.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400
                                   transition-colors"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(cv.id)}
                      className="p-2 rounded-xl hover:bg-rose-50 text-slate-400
                                 hover:text-rose-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Active CV info banner ── */}
      {activeCV && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50
                        border border-emerald-200 rounded-2xl">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-800">
            <span className="font-bold">{activeCV.originalName || activeCV.name}</span>
            {' '}is currently active and will be used in all AI skill runs.
          </p>
        </div>
      )}
    </PageShell>
  );
}
