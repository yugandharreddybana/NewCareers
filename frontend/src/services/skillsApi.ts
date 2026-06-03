/**
 * skillsApi.ts — single source of truth for the AI-skills HTTP layer.
 */
import { api, ensureFreshSession } from './api';
import type {
  RunAllSkillsBatchStatus,
  SkillRunResponse,
  SkillStartRequest,
  ConversationReplyRequest,
  RunAllSkillsResponse,
} from '@/types/skills';

const SKILL_TIMEOUT_MS    = 180_000;
const RUN_ALL_TIMEOUT_MS  = 600_000;
const PDF_TIMEOUT_MS      = 60_000;
const PDF_BUNDLE_TIMEOUT  = 120_000;

async function withFreshSessionRetry<T>(request: () => Promise<T>): Promise<T> {
  await ensureFreshSession();
  try {
    return await request();
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      await ensureFreshSession();
      return request();
    }
    throw err;
  }
}

export const skillsApi = {
  start: (req: SkillStartRequest): Promise<SkillRunResponse> =>
    api.post<SkillRunResponse>('/skills/start', req, {
      timeout: SKILL_TIMEOUT_MS,
      skipGlobalLoader: true,
    }).then(r => r.data),

  outreachDraft: (userJobId: string, channel = 'linkedin', tone = 'professional') =>
    api
      .post<import('@/types/skills-data').OutreachData>(
        '/skills/outreach/draft',
        null,
        {
          params: { userJobId, channel, tone },
          timeout: SKILL_TIMEOUT_MS,
          skipGlobalLoader: true,
        },
      )
      .then(r => r.data),

  applyQuestionAnswer: (
    userJobId: string,
    question: string,
    rerun = false,
  ): Promise<{ answer: string }> =>
    api
      .post<{ answer: string }>(
        '/skills/apply/answer',
        { userJobId, question, rerun },
        { timeout: SKILL_TIMEOUT_MS, skipGlobalLoader: true },
      )
      .then(r => r.data),

  reply: (req: ConversationReplyRequest): Promise<SkillRunResponse> =>
    api.post<SkillRunResponse>('/skills/conversation/reply', req, { timeout: SKILL_TIMEOUT_MS }).then(r => r.data),

  runAll: (userJobId: string): Promise<RunAllSkillsResponse> =>
    api.post<RunAllSkillsResponse>(
      `/skills/run-all/${userJobId}`, null, { timeout: RUN_ALL_TIMEOUT_MS },
    ).then(r => r.data),

  runAllAsync: (userJobId: string): Promise<RunAllSkillsBatchStatus> =>
    api.post<RunAllSkillsBatchStatus>(
      `/skills/run-all-async/${userJobId}`,
      null,
      { timeout: 30_000 },
    ).then(r => r.data),

  getRunAllStatus: (batchId: string): Promise<RunAllSkillsBatchStatus> =>
    api.get<RunAllSkillsBatchStatus>(`/skills/run-all/${batchId}/status`).then(r => r.data),

  /** Returns null when there is no saved run (HTTP 204). Never throws for "no previous run". */
  getLastRun: async (userJobId: string, skillName: string): Promise<SkillRunResponse | null> => {
    const r = await api.get<SkillRunResponse>(`/skills/last-run/${userJobId}/${skillName}`, {
      skipGlobalLoader: true,
      validateStatus: (status) => status === 200 || status === 204 || status === 404,
    });
    if (r.status === 204 || r.status === 404) return null;
    return r.data;
  },

  getCompletedSkills: async (userJobId: string): Promise<string[]> => {
    const r = await api.get<string[]>(`/skills/completed/${userJobId}`, {
      skipGlobalLoader: true,
      validateStatus: (status) => status === 200 || status === 404,
    });
    if (r.status === 404) return [];
    return r.data ?? [];
  },

  getRunHistory: async (userJobId: string, skillName: string) => {
    const r = await api.get<Array<{ id: string; createdAt: string; output: Record<string, unknown> }>>(
      `/skills/run-history/${userJobId}/${skillName}`,
      { skipGlobalLoader: true },
    );
    return r.data ?? [];
  },

  downloadSkillPdf: async (userJobId: string, skillName: string): Promise<void> => {
    const response = await withFreshSessionRetry(() =>
      api.get(
        `/skills/pdf/${userJobId}/${skillName}`,
        { responseType: 'blob', timeout: PDF_TIMEOUT_MS },
      ),
    );
    triggerDownload(asPdfBlob(response.data), `${skillName}-report.pdf`);
  },

  downloadEvaluationReportPdf: async (
    payload: import('@/lib/downloadJobEvaluationPdf').JobEvaluationPdfPayload,
    filename: string,
  ): Promise<void> => {
    try {
      const { sanitizeJobEvaluationPdfPayload } = await import('@/lib/downloadJobEvaluationPdf');
      const body = sanitizeJobEvaluationPdfPayload(payload);
      // Force deterministic JSON payload to avoid transport-time serialization edge cases.
      const jsonBody = JSON.stringify(body);
      JSON.parse(jsonBody);
      const response = await withFreshSessionRetry(() =>
        api.post('/skills/pdf/evaluation-report', jsonBody, {
          responseType: 'blob',
          timeout: PDF_TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const blob = asPdfBlob(response.data);
      if (blob.size < 5) {
        throw new Error('Empty PDF response');
      }
      triggerDownload(blob, filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    } catch (err: unknown) {
      const message = await pdfDownloadErrorMessage(err);
      throw new Error(message);
    }
  },

  downloadAllPdf: async (userJobId: string): Promise<void> => {
    const response = await withFreshSessionRetry(() =>
      api.get(
        `/skills/pdf/${userJobId}/all`,
        { responseType: 'blob', timeout: PDF_BUNDLE_TIMEOUT },
      ),
    );
    triggerDownload(asPdfBlob(response.data), 'careerops-complete-pack.pdf');
  },

  downloadResumePdf: async (userJobId: string): Promise<void> => {
    const response = await withFreshSessionRetry(() =>
      api.get(
        `/skills/pdf/${userJobId}/resume`,
        { responseType: 'blob', timeout: PDF_TIMEOUT_MS },
      ),
    );
    triggerDownload(asPdfBlob(response.data), 'tailored-resume.pdf');
  },

  downloadResumeDocx: async (userJobId: string): Promise<void> => {
    const response = await withFreshSessionRetry(() =>
      api.get(
        `/skills/docx/${userJobId}/resume`,
        {
          responseType: 'blob',
          timeout: PDF_TIMEOUT_MS,
        },
      ),
    );
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
    triggerDownload(blob, 'tailored-resume.docx');
  },

  getResumePreview: async (userJobId: string) => {
    const r = await api.get<{
      html: string;
      tailoredMarkdown: string;
      baselineMarkdown: string;
    }>(`/skills/resume/${userJobId}/preview`, {
      skipGlobalLoader: true,
      validateStatus: (status) => status === 200 || status === 204 || status === 404,
    });
    if (r.status === 204 || r.status === 404) return null;
    return r.data;
  },

  evaluate:      (userJobId: string)                       => skillsApi.start({ skillName: 'evaluate', userJobId }),
  tailorResume:  (userJobId: string)                       => skillsApi.start({ skillName: 'tailor-resume', userJobId }),
  research:      (userJobId: string)                       => skillsApi.start({ skillName: 'research', userJobId }),
  outreach:      (
    userJobId: string,
    channel: 'linkedin' | 'email' | 'follow-up' = 'linkedin',
    tone: 'professional' | 'conversational' | 'direct' = 'professional',
  ) =>
    skillsApi.start({ skillName: 'outreach', userJobId, channel, tone }),
  apply:         (userJobId: string, step = 'all')         => skillsApi.start({ skillName: 'apply', userJobId, step }),
  prepInterview: (userJobId: string)                       => skillsApi.start({ skillName: 'prep-interview', userJobId }),
  compare:       (userJobIds: string[])                    => skillsApi.start({ skillName: 'compare', compareJobIds: userJobIds }),
  triage:        ()                                        => skillsApi.start({ skillName: 'triage' }),
  last:          (userJobId: string, skill: string)        => skillsApi.getLastRun(userJobId, skill),
};

function asPdfBlob(data: unknown): Blob {
  if (data instanceof Blob) {
    return data.type === 'application/pdf' ? data : new Blob([data], { type: 'application/pdf' });
  }
  return new Blob([data as BlobPart], { type: 'application/pdf' });
}

async function pdfDownloadErrorMessage(err: unknown): Promise<string> {
  const ax = err as { response?: { status?: number; data?: unknown } };
  const data = ax.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const json = JSON.parse(text) as { error?: string; message?: string };
      if (json.error || json.message) {
        return json.error ?? json.message ?? 'Could not generate the PDF.';
      }
    } catch {
      /* not JSON */
    }
  }
  if (ax.response?.status === 400) {
    return 'PDF request was rejected — refresh the page, restart the Java backend if you recently updated, then try again.';
  }
  if (ax.response?.status === 404) {
    return 'PDF download is not available — restart the Java backend and middleware, then try again.';
  }
  if (ax.response?.status === 500) {
    return 'Could not generate the PDF — restart the Java backend and try again.';
  }
  if (ax.response?.status === 401) {
    return 'Sign in again to download your evaluation PDF.';
  }
  if (ax.response?.status === 403) {
    return 'Download was blocked by auth/session checks. Please retry once; if it persists, sign in again.';
  }
  if (ax.response?.status === 502) {
    return 'Backend unavailable — ensure Java and middleware are running.';
  }
  return 'Could not generate the PDF. Try again.';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url  = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
