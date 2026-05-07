/**
 * outreachApi.ts — typed client for /outreach.
 *
 * Pass 6 #6.011 — consolidated from src/api/outreachApi.ts. The shape
 * preserved here is the one consumed by OutreachPage.tsx (OutreachSequence,
 * OutreachCampaign with sequences/messages). The earlier services/ duplicate
 * was a scaffolded stub; replaced by this canonical impl.
 */
import { api } from './api';

export interface OutreachSequence {
  id: string;
  stepNumber: number;
  delayDays: number;
  subjectTemplate: string | null;
  bodyTemplate: string;
  channel: string;
}

export interface OutreachMessage {
  id: string;
  contactName: string | null;
  contactEmail: string | null;
  contactLinkedin: string | null;
  personalisedBody: string;
  status: 'draft' | 'scheduled' | 'sent' | 'opened' | 'replied' | 'bounced';
  score: number | null;
  unsubscribed: boolean;
  sendTimeHint: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  campaignType: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetCount: number;
  sentCount: number;
  repliedCount: number;
  positiveCount: number;
  replyRate: number;
  createdAt: string;
  sequences: OutreachSequence[];
  messages: OutreachMessage[];
}

export const outreachApi = {
  listCampaigns:     ()                                                              => api.get<{ campaigns: OutreachCampaign[]; total: number }>('/outreach/campaigns').then(r => r.data),
  getCampaign:       (id: string)                                                    => api.get<OutreachCampaign>(`/outreach/campaigns/${id}`).then(r => r.data),
  createCampaign:    (body: { name: string; campaignType: string })                  => api.post<OutreachCampaign>('/outreach/campaigns', body).then(r => r.data),
  launchCampaign:    (id: string)                                                    => api.post<OutreachCampaign>(`/outreach/campaigns/${id}/launch`).then(r => r.data),
  deleteCampaign:    (id: string)                                                    => api.delete(`/outreach/campaigns/${id}`, { params: { confirm: true } }),
  addSequence:       (id: string, body: Partial<OutreachSequence>)                   => api.post<OutreachSequence>(`/outreach/campaigns/${id}/sequences`, body).then(r => r.data),
  addMessage:        (id: string, body: Partial<OutreachMessage> & { sequenceId?: string }) =>
                                                                                        api.post<OutreachMessage>(`/outreach/campaigns/${id}/messages`, body).then(r => r.data),
  updateMessage:     (messageId: string, status: string)                             => api.patch<OutreachMessage>(`/outreach/messages/${messageId}`, { status }).then(r => r.data),
  unsubscribeMessage:(messageId: string)                                             => api.patch<OutreachMessage>(`/outreach/messages/${messageId}/unsubscribe`).then(r => r.data),
  getSendTime:       (campaignId: string)                                            => api.get<{ bestDay: string; bestHour: string; rationale: string }>(`/outreach/campaigns/${campaignId}/send-time`).then(r => r.data),
};
