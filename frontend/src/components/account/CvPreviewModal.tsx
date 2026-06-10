import { useEffect, useState } from 'react';
import { profileApi } from '@/services/api';

type Props = {
  open: boolean;
  fileName?: string | null;
  onClose: () => void;
  onDownload: () => void;
};

function isPdfFileName(name?: string | null): boolean {
  return (name ?? '').toLowerCase().endsWith('.pdf');
}

export function CvPreviewModal({ open, fileName, onClose, onDownload }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canPreviewPdf = isPdfFileName(fileName);

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }

    let revoked = false;
    setLoading(true);
    setError(null);

    profileApi
      .fetchCvBlob(fileName)
      .then(({ objectUrl }) => {
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setError('Could not load your CV for preview.');
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });

    return () => {
      revoked = true;
    };
  }, [open, fileName]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-preview-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-outline-variant account-settings-page"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-outline-variant">
          <div className="min-w-0">
            <h2 id="cv-preview-title" className="font-label-lg text-on-surface truncate">
              {fileName?.trim() || 'Your CV'}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="settings-btn-outline"
              onClick={onDownload}
            >
              Download
            </button>
            <button
              type="button"
              className="text-on-surface-variant hover:text-on-surface"
              onClick={onClose}
              aria-label="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading CV…</p>
          ) : error ? (
            <p className="text-sm text-on-surface-variant">{error}</p>
          ) : canPreviewPdf && previewUrl ? (
            <iframe
              title={fileName?.trim() || 'CV preview'}
              src={previewUrl}
              className="cv-preview-modal__frame"
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-on-surface-variant">
                Preview is not available for Word documents in the browser. Download the file to
                view it.
              </p>
              <button type="button" className="settings-btn-primary" onClick={onDownload}>
                Download CV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
