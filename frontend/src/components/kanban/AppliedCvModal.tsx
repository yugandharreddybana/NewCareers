import { useRef, useState } from 'react';
import { isApiError } from '@/types';
import { kanbanApi } from '@/services/api';
import toast from 'react-hot-toast';

interface Props {
  userJobId: string;
  jobTitle: string;
  onClose: () => void;
}

export default function AppliedCvModal({ userJobId, jobTitle, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      await kanbanApi.uploadCv(userJobId, file);
      toast.success('CV attached to application');
      onClose();
    } catch (e) {
      const msg = isApiError(e) ? e.normalizedMessage : 'Upload failed';
      toast.error(msg);
    } finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="font-semibold text-ink-900 text-lg">Attach the CV you submitted</h2>
        <p className="text-sm text-slate-500 mt-1">
          For <span className="font-medium text-ink-900">{jobTitle}</span>.<br />
          Upload the exact version you sent so you can retrieve it later.
        </p>

        <div
          className="mt-4 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-ink-700 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          onDragOver={e => e.preventDefault()}>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          {file
            ? <p className="text-sm text-emerald-700 font-medium">{file.name}</p>
            : <>
                <p className="text-sm text-slate-600">Drop CV here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">PDF or DOCX, max 5 MB</p>
              </>}
        </div>

        <div className="flex gap-3 mt-5">
          <button className="btn btn-secondary flex-1" onClick={onClose}>Skip for now</button>
          <button className="btn btn-primary flex-1" disabled={!file || uploading} onClick={upload}>
            {uploading ? 'Uploading…' : 'Attach CV'}
          </button>
        </div>
      </div>
    </div>
  );
}
