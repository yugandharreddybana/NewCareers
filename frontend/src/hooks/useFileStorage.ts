/**
 * useFileStorage.ts — Batch 3: Supabase file storage hook
 *
 * Typed wrappers for CV and resume-version file operations.
 * All uploads are multipart/form-data sent through the Node middleware.
 */
import { useState } from 'react';
import api from '../lib/api';

export interface UploadProgress {
  uploading: boolean;
  error: string | null;
}

// CV file operations

export function useCvUpload() {
  const [state, setState] = useState<UploadProgress>({ uploading: false, error: null });

  const uploadCv = async (file: File) => {
    setState({ uploading: true, error: null });
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/cv/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setState({ uploading: false, error: null });
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Upload failed';
      setState({ uploading: false, error: msg });
      throw err;
    }
  };

  return { ...state, uploadCv };
}

export async function getCvDownloadUrl(cvId: string): Promise<string> {
  const { data } = await api.get<{ url: string }>(`/cv/${cvId}/download`);
  return data.url;
}

export async function deleteCv(cvId: string): Promise<void> {
  await api.delete(`/cv/${cvId}`);
}

export async function activateCv(cvId: string): Promise<void> {
  await api.patch(`/cv/${cvId}/activate`);
}

// Resume version file operations

export function useResumeVersionUpload() {
  const [state, setState] = useState<UploadProgress>({ uploading: false, error: null });

  const uploadResumeFile = async (versionId: string, file: File) => {
    setState({ uploading: true, error: null });
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/resume-versions/${versionId}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setState({ uploading: false, error: null });
      return data;
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err.message ?? 'Upload failed';
      setState({ uploading: false, error: msg });
      throw err;
    }
  };

  return { ...state, uploadResumeFile };
}

export async function getResumeVersionDownloadUrl(
  versionId: string
): Promise<{ url: string; fileName: string }> {
  const { data } = await api.get<{ url: string; fileName: string }>(
    `/resume-versions/${versionId}/download`
  );
  return data;
}

export async function deleteResumeVersionFile(versionId: string) {
  const { data } = await api.delete(`/resume-versions/${versionId}/file`);
  return data;
}
