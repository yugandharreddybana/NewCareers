/**
 * resumeVersionsApi.ts — typed service layer for /api/resume-versions
 *
 * Handles version creation (text or file upload), diff comparison,
 * AI-powered best-version recommendation, and outcome tracking.
 */
import { api } from './api';

export interface ResumeVersion {
  id: string;
  label: string;
  targetRole: string | null;
  fileUrl: string | null;
  content: string | null;
  isActive: boolean;
  createdAt: string;
  outcome: 'unknown' | 'interview' | 'offer' | 'rejected' | null;
  applicationCount: number;
}

export interface ResumeVersionDiff {
  leftId: string;
  rightId: string;
  sections: {
    name: string;
    leftText: string;
    rightText: string;
    changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  }[];
}

export const resumeVersionsApi = {
  getAll: () =>
    api.get<ResumeVersion[]>('/resume-versions').then(r => r.data),

  create: (body: { label: string; targetRole?: string; content?: string }) =>
    api.post<ResumeVersion>('/resume-versions', body).then(r => r.data),

  /** Upload a PDF/DOCX file as a new resume version (no progress) */
  upload: (file: File, label: string, targetRole?: string) => {
    const fd = new FormData();
    fd.append('resume', file);
    fd.append('label', label);
    if (targetRole) fd.append('targetRole', targetRole);
    return api.post<ResumeVersion>('/resume-versions/upload', fd).then(r => r.data);
  },

  /**
   * Upload a resume file with XHR-based progress reporting.
   * @param file         The PDF/DOCX file to upload.
   * @param label        Human-readable label (defaults to file name without extension).
   * @param targetRole   Optional target role string.
   * @param onProgress   Called with a percentage (0-100) during upload.
   * @param controller   Optional AbortController to cancel the request.
   */
  uploadWithProgress: (
    file: File,
    label: string,
    targetRole: string | undefined,
    onProgress: (pct: number) => void,
    controller?: AbortController,
  ): Promise<ResumeVersion> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('resume', file);
      fd.append('label', label);
      if (targetRole) fd.append('targetRole', targetRole);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch { reject(new Error('Invalid server response.')); }
        } else {
          reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
      xhr.addEventListener('abort', () => reject(new DOMException('Upload aborted.', 'AbortError')));

      if (controller) {
        controller.signal.addEventListener('abort', () => xhr.abort());
      }

      const baseUrl = (import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_API_URL ?? '/api';
      xhr.open('POST', `${baseUrl}/resume-versions/upload`);

      const token = localStorage.getItem('token');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.send(fd);
    });
  },

  compare: (leftId: string, rightId: string) =>
    api.get<ResumeVersionDiff>(`/resume-versions/compare/${leftId}/${rightId}`).then(r => r.data),

  recommend: () =>
    api.get<{ recommendedId: string; reason: string }>('/resume-versions/recommend').then(r => r.data),

  getOne: (id: string) =>
    api.get<ResumeVersion>(`/resume-versions/${id}`).then(r => r.data),

  update: (id: string, body: Partial<Pick<ResumeVersion, 'label' | 'targetRole' | 'content'>>) =>
    api.put<ResumeVersion>(`/resume-versions/${id}`, body).then(r => r.data),

  recordOutcome: (id: string, outcome: ResumeVersion['outcome']) =>
    api.post(`/resume-versions/${id}/outcome`, { outcome }).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/resume-versions/${id}`).then(r => r.data),
};
