/**
 * skillsApi.ts — single source of truth for the AI-skills HTTP layer.
 *
 * Pass 6 #6.012 — was previously duplicated in `services/api.ts`. The api.ts
 * export is now a re-export of this module.
 *
 * All requests go through the Node middleware which forwards to the Java
 * backend. Skill runs are long-lived (Claude agentic loops) so we apply
 * generous timeouts per call.
 */
import toast from 'react-hot-toast';
import { api } from './api';
import * as mocks from './mockApi';
import { USE_MOCKS } from '@/lib/env';
import type {
  RunAllSkillsBatchStatus,
  SkillRunResponse,
  SkillStartRequest,
  ConversationReplyRequest,
  RunAllSkillsResponse,
} from '@/types/skills';

const SKILL_TIMEOUT_MS    = 180_000;   // single-skill agentic run
const RUN_ALL_TIMEOUT_MS  = 600_000;   // up to 10 min for the whole bundle
const PDF_TIMEOUT_MS      = 60_000;
const PDF_BUNDLE_TIMEOUT  = 120_000;

const RUN_ALL_MOCK_RESULTS: RunAllSkillsResponse['results'] = {
  evaluate: {
    type: 'RESULT',
    skillName: 'evaluate',
    data: mocks.MOCK_SKILL_RESULTS.evaluate as Record<string, unknown>,
  },
  research: {
    type: 'RESULT',
    skillName: 'research',
    data: mocks.MOCK_SKILL_RESULTS.research as Record<string, unknown>,
  },
};

const delay = (ms = 1500) => import.meta.env.MODE === 'test'
  ? Promise.resolve()
  : new Promise<void>(res => setTimeout(res, ms));

function mockResult(skillName: string): SkillRunResponse {
  const data = (mocks.MOCK_SKILL_RESULTS[skillName] as Record<string, unknown> | undefined)
    ?? { text: 'Skill execution complete.' };
  return { type: 'RESULT', skillName, data };
}

function notifyMockDownload(label: string): void {
  toast.success(`Mock: ${label} download triggered.`);
}

export const skillsApi = {

  // ── Start any skill ────────────────────────────────────────
  start: async (req: SkillStartRequest): Promise<SkillRunResponse> => {
    if (USE_MOCKS) { await delay(); return mockResult(req.skillName); }
    const r = await api.post<SkillRunResponse>('/skills/start', req, { timeout: SKILL_TIMEOUT_MS });
    return r.data;
  },

  // ── Reply to Claude's question ────────────────────────────
  reply: async (req: ConversationReplyRequest): Promise<SkillRunResponse> => {
    if (USE_MOCKS) { await delay(); return mockResult('reply'); }
    const r = await api.post<SkillRunResponse>('/skills/conversation/reply', req, { timeout: SKILL_TIMEOUT_MS });
    return r.data;
  },

  // ── Run all skills for a job ──────────────────────────────
  runAll: async (userJobId: string): Promise<RunAllSkillsResponse> => {
    if (USE_MOCKS) {
      await delay(2000);
      return {
        total: Object.keys(RUN_ALL_MOCK_RESULTS).length,
        succeeded: Object.keys(RUN_ALL_MOCK_RESULTS).length,
        failed: 0,
        pendingAnswers: 0,
        results: RUN_ALL_MOCK_RESULTS,
      };
    }
    const r = await api.post<RunAllSkillsResponse>(
      `/skills/run-all/${userJobId}`, null, { timeout: RUN_ALL_TIMEOUT_MS }
    );
    return r.data;
  },

  runAllAsync: async (userJobId: string): Promise<RunAllSkillsBatchStatus> => {
    if (USE_MOCKS) {
      await delay(300);
      return {
        id: 'mock-batch',
        userJobId,
        status: 'in_progress',
        total: 14,
        completed: 0,
        createdAt: new Date().toISOString(),
        results: {},
      };
    }

    const r = await api.post<RunAllSkillsBatchStatus>(
      `/skills/run-all-async/${userJobId}`,
      null,
      { timeout: 30_000 },
    );
    return r.data;
  },

  getRunAllStatus: async (batchId: string): Promise<RunAllSkillsBatchStatus> => {
    if (USE_MOCKS) {
      await delay(250);
      return {
        id: batchId,
        userJobId: 'mock-job',
        status: 'completed',
        total: 14,
        completed: 14,
        createdAt: new Date().toISOString(),
        results: {},
      };
    }

    const r = await api.get<RunAllSkillsBatchStatus>(`/skills/run-all/${batchId}/status`);
    return r.data;
  },

  // ── Cached last-run lookup ────────────────────────────────
  getLastRun: async (userJobId: string, skillName: string): Promise<SkillRunResponse> => {
    if (USE_MOCKS) { await delay(200); return mockResult(skillName); }
    const r = await api.get<SkillRunResponse>(`/skills/last-run/${userJobId}/${skillName}`);
    return r.data;
  },

  // ── PDF downloads ─────────────────────────────────────────
  downloadSkillPdf: async (userJobId: string, skillName: string): Promise<void> => {
    if (USE_MOCKS) {
      notifyMockDownload(`${skillName} report`);
      return;
    }
    const response = await api.get(
      `/skills/pdf/${userJobId}/${skillName}`,
      { responseType: 'blob', timeout: PDF_TIMEOUT_MS },
    );
    triggerDownload(response.data as Blob, `${skillName}-report.pdf`);
  },

  downloadAllPdf: async (userJobId: string): Promise<void> => {
    if (USE_MOCKS) {
      notifyMockDownload('complete pack');
      return;
    }
    const response = await api.get(
      `/skills/pdf/${userJobId}/all`,
      { responseType: 'blob', timeout: PDF_BUNDLE_TIMEOUT },
    );
    triggerDownload(response.data as Blob, 'careerops-complete-pack.pdf');
  },

  downloadResumePdf: async (userJobId: string): Promise<void> => {
    if (USE_MOCKS) {
      notifyMockDownload('tailored resume');
      return;
    }
    const response = await api.get(
      `/skills/pdf/${userJobId}/resume`,
      { responseType: 'blob', timeout: PDF_TIMEOUT_MS },
    );
    triggerDownload(response.data as Blob, 'tailored-resume.pdf');
  },

  // ── Convenience aliases (preserve legacy api.ts call sites) ───
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

/** Trigger a browser file download from a Blob response. */
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
