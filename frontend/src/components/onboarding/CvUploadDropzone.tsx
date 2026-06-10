import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.docx';

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  id?: string;
  variant?: 'compact' | 'hero';
  showLabel?: boolean;
  required?: boolean;
  disabled?: boolean;
};

function validateFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'doc') {
    toast.error('Legacy .doc files are not supported. Please upload a PDF or DOCX file.');
    return false;
  }
  if (!['pdf', 'docx'].includes(ext)) {
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
  disabled = false,
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
          disabled={disabled}
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
          disabled={disabled}
          onChange={e => {
            acceptFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="onboarding-field">
        {showLabel && (
          <label className="onboarding-form-section__title" htmlFor={id}>
            Upload your CV/Resume
            {required && <span className="onboarding-required"> *</span>}
          </label>
        )}
        <div
          className={`onboarding-cv-zone group${dragOver && !disabled ? ' onboarding-cv-zone--active' : ''}${disabled ? ' onboarding-cv-zone--disabled' : ''}`}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          onKeyDown={e => {
            if (disabled) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={e => {
            if (disabled) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            if (disabled) return;
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
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            onChange={e => {
              acceptFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
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
