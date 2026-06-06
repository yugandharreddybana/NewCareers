import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx';

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  id?: string;
  variant?: 'compact' | 'hero';
  showLabel?: boolean;
  required?: boolean;
};

function validateFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['pdf', 'doc', 'docx'].includes(ext)) {
    toast.error('Please upload a PDF or DOCX file.');
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast.error('File must be 5 MB or smaller.');
    return false;
  }
  return true;
}

export function CvUploadDropzone({
  file,
  onFile,
  id = 'cvUpload',
  variant = 'hero',
  showLabel = true,
  required = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const acceptFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        onFile(null);
        return;
      }
      if (validateFile(candidate)) {
        onFile(candidate);
      }
    },
    [onFile],
  );

  if (variant === 'compact' && file) {
    return (
      <div className="onboarding-cv-uploaded">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">
          description
        </span>
        <span className="onboarding-cv-uploaded__name">{file.name}</span>
        <button
          type="button"
          className="onboarding-cv-uploaded__replace"
          onClick={() => inputRef.current?.click()}
        >
          Replace
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={e => acceptFile(e.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div>
        {showLabel && (
          <label className="block font-label-md text-label-md text-on-surface mb-[8px]" htmlFor={id}>
            Upload your CV/Resume
            {required && <span className="text-error"> *</span>}
          </label>
        )}
        <div
          className={`onboarding-cv-zone group${dragOver ? ' onboarding-cv-zone--active' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={e => acceptFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4 z-0 relative">
            <span
              className="material-symbols-outlined onboarding-cv-zone__icon"
              aria-hidden="true"
            >
              upload_file
            </span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              <span className="font-label-md text-primary font-semibold">Click to upload</span>
              {' '}or drag and drop
            </p>
            <p
              className={`font-label-sm text-label-sm mt-1 ${
                file ? 'text-primary font-medium' : 'text-outline'
              }`}
            >
              {file
                ? file.name
                : "PDF, DOCX up to 5MB. We'll parse the details automatically."}
            </p>
          </div>
          <div className="onboarding-cv-zone__pattern" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return null;
}
