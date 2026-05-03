import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { outreachApi, type OutreachCampaign, type OutreachTemplate } from '@/services/outreachApi';
import toast from 'react-hot-toast';
import {
  Send, Plus, Trash2, Play, Pause, Mail,
  Linkedin, BarChart2, MessageSquare, RefreshCw,
  CheckCircle, Clock, AlertTriangle, X,
} from 'lucide-react';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

const MOCK_CAMPAIGNS: OutreachCampaign[] = [
  { id: 'c-1', name: 'Q2 Dublin Fintech Push', status: 'active', channel: 'linkedin', totalMessages: 20, sentMessages: 8, openRate: 0.62, replyRate: 0.375, createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'c-2', name: 'Remote Node.js Roles', status: 'draft', channel: 'email', totalMessages: 15, sentMessages: 0, openRate: null, replyRate: null, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'c-3', name: 'Cork Tech Companies', status: 'completed', channel: 'email', totalMessages: 12, sentMessages: 12, openRate: 0.5, replyRate: 0.25, createdAt: new Date(Date.now() - 86400000 * 14).toISOString() },
];

const MOCK_TEMPLATES: OutreachTemplate[] = [
  { id: 't-1', name: 'LinkedIn Cold Connect', subject: '', body: "Hi {{name}}, I came across your profile and noticed you work at {{company}}. I'm a Senior Full Stack Developer (React/Node) exploring opportunities — would love to connect!", channel: 'linkedin' },
  { id: 't-2', name: 'Email Follow-up',        subject: 'Following up — {{jobTitle}} application', body: "Hi {{name}},\n\nI wanted to follow up on my application for the {{jobTitle}} role. I'm very excited about the opportunity at {{company}} and would love to discuss further.\n\nBest regards,\n{{yourName}}", channel: 'email' },
];

const STATUS_STYLES: Record<OutreachCampaign['status'], string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  linkedin: <Linkedin size={13} />,
  email:    <Mail size={13} />,
  twitter:  <MessageSquare size={13} />,
};

function pct(n: number | null) {
  return n !== null ? `${Math.round(n * 100)}%` : '—';
}

// ── Create campaign modal ─────────────────────────────────────────────────────
const CreateCampaignModal: React.FC<{
  templates: OutreachTemplate[];
  onClose: () => void;
  onCreate: (c: OutreachCampaign) => void;
}> = ({ templates, onClose, onCreate }) => {
  const [name, setName]       = useState('');
  const [channel, setChannel] = useState<'email' | 'linkedin'>('linkedin');
  const [templateId, setTpl]  = useState('');
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Campaign name is required.'); return; }
    setSaving(true);
    try {
      const c = USE_MOCKS
        ? { id: `c-${Date.now()}`, name, status: 'draft' as const, channel, totalMessages: 0, sentMessages: 0, openRate: null, replyRate: null, createdAt: new Date().toISOString() }
        : await outreachApi.createCampaign({ name, channel, templateId: templateId || undefined });
      onCreate(c);
      toast.success('Campaign created!');
      onClose();
    } catch { toast.error('Failed to create campaign.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">New Campaign</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Campaign Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Dublin Fintech Outreach"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Channel</label>
          <div className="flex gap-2">
            {(['linkedin', 'email'] as const).map(ch => (
              <button key={ch} onClick={() => setChannel(ch)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  channel === ch ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}>
                {CHANNEL_ICON[ch]} {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {templates.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Starting Template (optional)</label>
            <select value={templateId} onChange={e => setTpl(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              <option value="">No template</option>
              {templates.filter(t => t.channel === channel).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Template card ─────────────────────────────────────────────────────────────
const TemplateCard: React.FC<{ tpl: OutreachTemplate; onDelete: (id: string) => void }> = ({ tpl, onDelete }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{CHANNEL_ICON[tpl.channel]}</span>
        <p className="text-sm font-semibold text-gray-900">{tpl.name}</p>
      </div>
      <button onClick={() => onDelete(tpl.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={13} /></button>
    </div>
    {tpl.subject && <p className="text-xs text-gray-500 font-medium">Subject: {tpl.subject}</p>}
    <p className="text-xs text-gray-400 line-clamp-2">{tpl.body}</p>
  </div>
);

// ── Campaign card ─────────────────────────────────────────────────────────────
const CampaignCard: React.FC<{
  c: OutreachCampaign;
  onLaunch: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ c, onLaunch, onDelete }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-900">{c.name}</p>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${STATUS_STYLES[c.status]}`}>{c.status}</span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400">{CHANNEL_ICON[c.channel]} {c.channel}</span>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {[
            { label: 'Sent', value: `${c.sentMessages}/${c.totalMessages}` },
            { label: 'Open rate', value: pct(c.openRate) },
            { label: 'Reply rate', value: pct(c.replyRate) },
          ].map(m => (
            <div key={m.label}>
              <p className="text-[10px] text-gray-400">{m.label}</p>
              <p className="text-sm font-bold text-gray-900">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {c.status === 'draft' && (
          <button onClick={() => onLaunch(c.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors">
            <Play size={11} /> Launch
          </button>
        )}
        <button onClick={() => onDelete(c.id)}
          className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const OutreachPage: React.FC = () => {
  const [campaigns, setCampaigns]   = useState<OutreachCampaign[]>([]);
  const [templates, setTemplates]   = useState<OutreachTemplate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'campaigns' | 'templates'>('campaigns');
  const [showModal, setShowModal]   = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (USE_MOCKS) {
          await new Promise(r => setTimeout(r, 500));
          setCampaigns(MOCK_CAMPAIGNS);
          setTemplates(MOCK_TEMPLATES);
        } else {
          const [cams, tpls] = await Promise.all([
            outreachApi.getCampaigns().catch(() => MOCK_CAMPAIGNS),
            outreachApi.getTemplates().catch(() => MOCK_TEMPLATES),
          ]);
          setCampaigns(cams);
          setTemplates(tpls);
        }
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleLaunch = async (id: string) => {
    try {
      if (!USE_MOCKS) await outreachApi.launchCampaign(id);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'active' as const } : c));
      toast.success('Campaign launched!');
    } catch { toast.error('Failed to launch campaign.'); }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      if (!USE_MOCKS) await outreachApi.deleteCampaign(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast.success('Campaign deleted.');
    } catch { toast.error('Failed to delete campaign.'); }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      if (!USE_MOCKS) await outreachApi.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template deleted.');
    } catch { toast.error('Failed to delete template.'); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400 text-sm">Loading outreach…</div>;

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalSent       = campaigns.reduce((s, c) => s + c.sentMessages, 0);
  const avgReply        = campaigns.filter(c => c.replyRate !== null);
  const avgReplyRate    = avgReply.length ? avgReply.reduce((s, c) => s + (c.replyRate ?? 0), 0) / avgReply.length : 0;

  return (
    <>
      <PageMeta title="Outreach — CareerOps" />
      {showModal && <CreateCampaignModal templates={templates} onClose={() => setShowModal(false)} onCreate={c => setCampaigns(prev => [c, ...prev])} />}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Outreach</h1>
            <p className="text-sm text-gray-500 mt-1">Run targeted campaigns to recruiters and hiring managers.</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} /> New Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Campaigns', value: activeCampaigns, icon: <Play size={15} /> },
            { label: 'Messages Sent',    value: totalSent,       icon: <Send size={15} /> },
            { label: 'Avg Reply Rate',   value: `${Math.round(avgReplyRate * 100)}%`, icon: <BarChart2 size={15} /> },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{s.icon}</div>
              <div>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-[10px] text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {(['campaigns', 'templates'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'campaigns' ? `Campaigns (${campaigns.length})` : `Templates (${templates.length})`}
            </button>
          ))}
        </div>

        {tab === 'campaigns' && (
          <div className="space-y-3">
            {campaigns.length > 0
              ? campaigns.map(c => <CampaignCard key={c.id} c={c} onLaunch={handleLaunch} onDelete={handleDeleteCampaign} />)
              : <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                  <Send size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No campaigns yet. Create your first to start reaching out.</p>
                </div>
            }
          </div>
        )}

        {tab === 'templates' && (
          <div className="space-y-3">
            {templates.map(t => <TemplateCard key={t.id} tpl={t} onDelete={handleDeleteTemplate} />)}
            {templates.length === 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No templates yet. Templates are auto-generated by the AI Outreach Skill.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
};

export default OutreachPage;
