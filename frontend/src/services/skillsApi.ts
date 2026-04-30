import { api } from './api';
import type {
  SkillRunResponse,
  SkillStartRequest,
  ConversationReplyRequest,
  RunAllSkillsResponse,
} from '../types/skills';

/**
 * Skills API — unified endpoints replacing all old per-skill calls.
 *
 * All requests go through the Node middleware which forwards to the Java backend.
 * Long timeout (180s) set for Claude agentic runs that may take 60-90s.
 */
const skillsAxios = api; // reuse existing axios instance with baseURL + interceptors

export const skillsApi = {

  // ── Start any skill ────────────────────────────────────────
  start: (req: SkillStartRequest): Promise<SkillRunResponse> =>
    skillsAxios
      .post('/skills/start', req, { timeout: 180_000 })
      .then(r => r.data),

  // ── Reply to Claude's question ────────────────────────────
  reply: (req: ConversationReplyRequest): Promise<SkillRunResponse> =>
    skillsAxios
      .post('/skills/conversation/reply', req, { timeout: 180_000 })
      .then(r => r.data),

  // ── Run all 9 skills for a job ────────────────────────────
  runAll: (userJobId: string): Promise<RunAllSkillsResponse> =>
    skillsAxios
      .post(`/skills/run-all/${userJobId}`, null, { timeout: 600_000 })
      .then(r => r.data),

  // ── Get last run without re-executing ────────────────────
  getLastRun: (userJobId: string, skillName: string): Promise<SkillRunResponse> =>
    skillsAxios
      .get(`/skills/last-run/${userJobId}/${skillName}`)
      .then(r => r.data),

  // ── PDF Downloads ─────────────────────────────────────────
  downloadSkillPdf: async (userJobId: string, skillName: string): Promise<void> => {
    const response = await skillsAxios.get(
      `/skills/pdf/${userJobId}/${skillName}`,
      { responseType: 'blob', timeout: 60_000 }
    );
    triggerDownload(response.data, `${skillName}-report.pdf`);
  },

  downloadAllPdf: async (userJobId: string): Promise<void> => {
    const response = await skillsAxios.get(
      `/skills/pdf/${userJobId}/all`,
      { responseType: 'blob', timeout: 120_000 }
    );
    triggerDownload(response.data, 'careerops-complete-pack.pdf');
  },

  downloadResumePdf: async (userJobId: string): Promise<void> => {
    const response = await skillsAxios.get(
      `/skills/pdf/${userJobId}/resume`,
      { responseType: 'blob', timeout: 60_000 }
    );
    triggerDownload(response.data, 'tailored-resume.pdf');
  },
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
