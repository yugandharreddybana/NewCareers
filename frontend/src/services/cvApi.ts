/**
 * Task 138 — CV Manager API client.
 * Wired to /cv/** backend routes.
 */
import { api } from '@/services/api';

export type CvRecord = {
  id: string;
  name: string;
  originalName: string;
  url: string;
  isActive: boolean;
  sizeBytes: number;
  createdAt: string;
};

export const cvApi = {
  /** List all CVs for the authenticated user */
  list: (): Promise<CvRecord[]> =>
    api.get('/cv').then(r => r.data),

  /** Upload a new CV (multipart/form-data) — no progress tracking */
  upload: (file: File): Promise<CvRecord> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/cv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    }).then(r => r.data);
  },

  /**
   * Upload a new CV with XHR-based progress reporting.
   * @param file         The file to upload.
   * @param onProgress   Called with a percentage (0-100) as the upload progresses.
   * @param controller   Optional AbortController; abort() cancels the XHR.
   */
  uploadWithProgress: (
    file: File,
    onProgress: (pct: number) => void,
    controller?: AbortController,
  ): Promise<CvRecord> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fd = new FormData();
      fd.append('file', file);

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
      xhr.open('POST', `${baseUrl}/cv`);

      // Forward the auth token if present
      const token = localStorage.getItem('token');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.send(fd);
    });
  },

  /** Delete a CV by id */
  remove: (id: string): Promise<{ success: boolean }> =>
    api.delete(`/cv/${id}`).then(r => r.data),

  /** Set a CV as the active/default one used in skill runs */
  setActive: (id: string): Promise<CvRecord> =>
    api.post(`/cv/${id}/activate`).then(r => r.data),

  /** Download a CV as a blob */
  download: (id: string, fileName: string): Promise<void> =>
    api.get(`/cv/${id}/download`, { responseType: 'blob', timeout: 30_000 }).then(r => {
      const url = window.URL.createObjectURL(r.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }),
};
