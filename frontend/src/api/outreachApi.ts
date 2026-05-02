import axios from './axiosInstance';

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
  listCampaigns:     () =>
    axios.get<{ campaigns: OutreachCampaign[]; total: number }>('/outreach/campaigns').then(r => r.data),
  getCampaign:       (id: string) =>
    axios.get<OutreachCampaign>(`/outreach/campaigns/${id}`).then(r => r.data),
  createCampaign:    (body: { name: string; campaignType: string }) =>
    axios.post<OutreachCampaign>('/outreach/campaigns', body).then(r => r.data),
  launchCampaign:    (id: string) =>
    axios.post<OutreachCampaign>(`/outreach/campaigns/${id}/launch`).then(r => r.data),
  deleteCampaign:    (id: string) =>
    axios.delete(`/outreach/campaigns/${id}`),
  addSequence:       (id: string, body: Partial<OutreachSequence>) =>
    axios.post<OutreachSequence>(`/outreach/campaigns/${id}/sequences`, body).then(r => r.data),
  addMessage:        (id: string, body: Partial<OutreachMessage> & { sequenceId?: string }) =>
    axios.post<OutreachMessage>(`/outreach/campaigns/${id}/messages`, body).then(r => r.data),
  updateMessage:     (messageId: string, status: string) =>
    axios.patch<OutreachMessage>(`/outreach/messages/${messageId}`, { status }).then(r => r.data),
};
