/**
 * outreachApi.ts — typed service layer for /api/outreach
 *
 * Covers campaigns, sequences, messages, templates, and send-time suggestions.
 */
import { api } from './api';

export interface OutreachTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  channel: 'email' | 'linkedin' | 'twitter';
}

export interface OutreachCampaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  channel: string;
  totalMessages: number;
  sentMessages: number;
  openRate: number | null;
  replyRate: number | null;
  createdAt: string;
}

export interface OutreachMessage {
  id: string;
  campaignId: string;
  contactName: string;
  contactEmail: string;
  status: 'pending' | 'sent' | 'opened' | 'replied' | 'bounced' | 'unsubscribed';
  sentAt: string | null;
}

export const outreachApi = {
  // ── Templates ───────────────────────────────────────────────────
  getTemplates: () =>
    api.get<OutreachTemplate[]>('/outreach/templates').then(r => r.data),

  createTemplate: (body: Omit<OutreachTemplate, 'id'>) =>
    api.post<OutreachTemplate>('/outreach/templates', body).then(r => r.data),

  deleteTemplate: (id: string) =>
    api.delete(`/outreach/templates/${id}`).then(r => r.data),

  // ── Campaigns ──────────────────────────────────────────────────
  getCampaigns: () =>
    api.get<OutreachCampaign[]>('/outreach/campaigns').then(r => r.data),

  createCampaign: (body: { name: string; channel: string; templateId?: string }) =>
    api.post<OutreachCampaign>('/outreach/campaigns', body).then(r => r.data),

  getCampaign: (id: string) =>
    api.get<OutreachCampaign>(`/outreach/campaigns/${id}`).then(r => r.data),

  launchCampaign: (id: string) =>
    api.post(`/outreach/campaigns/${id}/launch`).then(r => r.data),

  deleteCampaign: (id: string) =>
    api.delete(`/outreach/campaigns/${id}`).then(r => r.data),

  addSequenceStep: (campaignId: string, body: { delay: number; templateId: string }) =>
    api.post(`/outreach/campaigns/${campaignId}/sequences`, body).then(r => r.data),

  addMessage: (campaignId: string, body: { contactEmail: string; contactName: string }) =>
    api.post(`/outreach/campaigns/${campaignId}/messages`, body).then(r => r.data),

  getSendTimeSuggestion: (campaignId: string) =>
    api.get<{ suggestedHour: number; timezone: string }>(`/outreach/campaigns/${campaignId}/send-time`).then(r => r.data),

  // ── Messages ───────────────────────────────────────────────────
  updateMessageStatus: (messageId: string, status: OutreachMessage['status']) =>
    api.patch(`/outreach/messages/${messageId}`, { status }).then(r => r.data),

  unsubscribeContact: (messageId: string) =>
    api.patch(`/outreach/messages/${messageId}/unsubscribe`).then(r => r.data),
};
