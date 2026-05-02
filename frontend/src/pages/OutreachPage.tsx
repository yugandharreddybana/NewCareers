import { useEffect, useState, useCallback } from 'react';
import { outreachApi, type OutreachCampaign } from '@/api/outreachApi';
import toast from 'react-hot-toast';
import { MessageSquare, Plus, Rocket, Trash2, ChevronDown, ChevronRight, Send, MailCheck, MessageCircle } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  recruiter_outreach: 'Recruiter Outreach',
  alumni_outreach:    'Alumni Outreach',
  referral_request:   'Referral Request',
  follow_up:          'Follow-up',
};

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
};

const MSG_STATUS_COLOR: Record<string, string> = {
  draft:     'text-slate-400',
  scheduled: 'text-blue-500',
  sent:      'text-blue-600',
  opened:    'text-yellow-600',
  replied:   'text-green-600',
  bounced:   'text-red-500',
};

export default function OutreachPage() {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [form, setForm]           = useState({ name: '', campaignType: 'recruiter_outreach' });
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const [detail, setDetail]       = useState<Record<string, OutreachCampaign>>({});

  const load = useCallback(async () => {
    try {
      const data = await outreachApi.listCampaigns();
      setCampaigns(data.campaigns);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleExpand(id: string) {
    if (expanded[id]) {
      setExpanded(e => ({ ...e, [id]: false }));
      return;
    }
    setExpanded(e => ({ ...e, [id]: true }));
    if (!detail[id]) {
      try {
        const d = await outreachApi.getCampaign(id);
        setDetail(prev => ({ ...prev, [id]: d }));
      } catch {
        toast.error('Failed to load campaign detail');
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const c = await outreachApi.createCampaign(form);
      setCampaigns(prev => [c, ...prev]);
      setCreating(false);
      setForm({ name: '', campaignType: 'recruiter_outreach' });
      toast.success('Campaign created');
    } catch {
      toast.error('Failed to create');
    }
  }

  async function handleLaunch(id: string) {
    try {
      const updated = await outreachApi.launchCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c));
      setDetail(prev => ({ ...prev, [id]: updated }));
      toast.success('Campaign launched!');
    } catch {
      toast.error('Failed to launch');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this campaign?')) return;
    try {
      await outreachApi.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <MessageSquare size={22} className="text-brand-500" />
            Outreach Campaigns
          </h1>
          <p className="text-sm text-text-tertiary mt-1">
            Multi-step LinkedIn and email outreach sequences with contact tracking
          </p>
        </div>
        <button
          onClick={() => setCreating(c => !c)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg
                     text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate}
              className="bg-white border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-text-primary">New Campaign</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Campaign name *</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Google Recruiter Outreach"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Type</label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                value={form.campaignType}
                onChange={e => setForm(f => ({ ...f, campaignType: e.target.value }))}
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit"
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium
                               hover:bg-brand-600 transition-colors">
              Create
            </button>
            <button type="button" onClick={() => setCreating(false)}
                    className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-surface-raised
                               transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Summary stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Campaigns',  value: campaigns.length },
            { label: 'Sent',       value: campaigns.reduce((s, c) => s + c.sentCount, 0) },
            { label: 'Replies',    value: campaigns.reduce((s, c) => s + c.repliedCount, 0) },
            { label: 'Reply Rate', value: (() => {
              const sent = campaigns.reduce((s, c) => s + c.sentCount, 0);
              const rep  = campaigns.reduce((s, c) => s + c.repliedCount, 0);
              return sent > 0 ? `${Math.round(rep / sent * 100)}%` : '—';
            })() },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-tertiary mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-text-tertiary">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare size={40} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">No campaigns yet</p>
          <p className="text-sm text-text-tertiary mt-1">
            Create a campaign to start tracking your outreach sequences.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const d = detail[c.id] ?? c;
            return (
              <div key={c.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(c.id)}
                    className="flex-1 flex items-center gap-3 text-left hover:text-text-primary
                               transition-colors"
                  >
                    {expanded[c.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-text-primary">{c.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>
                          {c.status}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-raised text-text-tertiary">
                          {TYPE_LABELS[c.campaignType] ?? c.campaignType}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-text-tertiary">
                        <span className="flex items-center gap-1">
                          <Send size={10} /> {c.sentCount} sent
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={10} /> {c.repliedCount} replied
                        </span>
                        {c.sentCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MailCheck size={10} /> {c.replyRate}% reply rate
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {c.status === 'draft' && (
                      <button
                        onClick={() => handleLaunch(c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white
                                   rounded-lg text-xs font-medium hover:bg-brand-600 transition-colors"
                      >
                        <Rocket size={12} /> Launch
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-text-tertiary hover:text-danger-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {expanded[c.id] && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    {/* Sequences */}
                    {d.sequences?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                          Sequence Steps
                        </p>
                        <div className="space-y-2">
                          {d.sequences.map(s => (
                            <div key={s.id}
                                 className="flex items-start gap-3 bg-surface-raised rounded-lg p-3 text-sm">
                              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs
                                             flex items-center justify-center font-bold shrink-0">
                                {s.stepNumber}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-text-secondary uppercase">
                                    {s.channel}
                                  </span>
                                  {s.delayDays > 0 && (
                                    <span className="text-[10px] text-text-tertiary">
                                      +{s.delayDays}d
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-text-tertiary line-clamp-2">
                                  {s.bodyTemplate}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {d.messages?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                          Contacts ({d.messages.length})
                        </p>
                        <div className="space-y-2">
                          {d.messages.map(m => (
                            <div key={m.id}
                                 className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-text-primary">
                                  {m.contactName ?? 'Unknown'}
                                </span>
                                {m.score && (
                                  <span className="ml-2 text-[10px] text-text-tertiary">
                                    score: {m.score}
                                  </span>
                                )}
                              </div>
                              <span className={`text-xs font-medium capitalize ${MSG_STATUS_COLOR[m.status]}`}>
                                {m.status}
                              </span>
                              {m.sentAt && (
                                <span className="text-[11px] text-text-tertiary">
                                  {new Date(m.sentAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
