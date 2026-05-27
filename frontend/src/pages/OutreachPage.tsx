import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { outreachApi, type OutreachCampaign } from '@/services/outreachApi';
import { BarChart2, Mail, MessageSquare, Play, Plus, Send, Trash2, X } from 'lucide-react';

type OutreachChannel = 'linkedin' | 'email' | 'twitter';

interface OutreachTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  channel: OutreachChannel;
}

interface OutreachCampaignView {
  id: string;
  name: string;
  status: OutreachCampaign['status'];
  channel: OutreachChannel;
  totalMessages: number;
  sentMessages: number;
  openRate: number | null;
  replyRate: number | null;
  createdAt: string;
}

const STATUS_STYLES: Record<OutreachCampaignView['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

const CHANNEL_ICON: Record<OutreachChannel, JSX.Element> = {
  linkedin: <MessageSquare size={13} />,
  email: <Mail size={13} />,
  twitter: <Send size={13} />,
};

function pct(value: number | null) {
  return value !== null ? `${Math.round(value * 100)}%` : '—';
}

function inferChannel(campaign: OutreachCampaign): OutreachChannel {
  const sequenceChannel = campaign.sequences[0]?.channel?.toLowerCase();
  if (sequenceChannel === 'linkedin' || sequenceChannel === 'email' || sequenceChannel === 'twitter') {
    return sequenceChannel;
  }

  const type = campaign.campaignType.toLowerCase();
  if (type.includes('linkedin')) return 'linkedin';
  if (type.includes('twitter')) return 'twitter';
  return 'email';
}

function toCampaignView(campaign: OutreachCampaign): OutreachCampaignView {
  const messageCount = campaign.messages.length;
  const openedCount = campaign.messages.filter(message => message.status === 'opened' || message.status === 'replied').length;

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    channel: inferChannel(campaign),
    totalMessages: campaign.targetCount > 0 ? campaign.targetCount : messageCount,
    sentMessages: campaign.sentCount,
    openRate: messageCount > 0 ? openedCount / messageCount : null,
    replyRate: campaign.sentCount > 0 ? campaign.replyRate : null,
    createdAt: campaign.createdAt,
  };
}

const CreateCampaignModal = ({
  templates,
  onClose,
  onCreate,
}: {
  templates: OutreachTemplate[];
  onClose: () => void;
  onCreate: (campaign: OutreachCampaignView) => void;
}) => {
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'email' | 'linkedin'>('linkedin');
  const [templateId, setTemplateId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Campaign name is required.');
      return;
    }

    setSaving(true);
    try {
      const campaign = toCampaignView(await outreachApi.createCampaign({
        name,
        campaignType: channel,
      }));

      onCreate(campaign);
      if (templateId) {
        toast.success('Campaign created. Template selection is not wired to the current backend yet.');
      } else {
        toast.success('Campaign created!');
      }
      onClose();
    } catch {
      toast.error('Failed to create campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">New Campaign</h2>
          <button aria-label="Close modal" title="Close modal" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Campaign Name</label>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Dublin Fintech Outreach"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Channel</label>
          <div className="flex gap-2">
            {(['linkedin', 'email'] as const).map(item => (
              <button
                key={item}
                onClick={() => setChannel(item)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  channel === item ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {CHANNEL_ICON[item]} {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {templates.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Starting Template (mock-only)</label>
            <select
              aria-label="Starting template"
              value={templateId}
              onChange={event => setTemplateId(event.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">No template</option>
              {templates.filter(template => template.channel === channel).map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TemplateCard = ({ tpl, onDelete }: { tpl: OutreachTemplate; onDelete: (id: string) => void }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{CHANNEL_ICON[tpl.channel]}</span>
        <p className="text-sm font-semibold text-gray-900">{tpl.name}</p>
      </div>
      <button aria-label="Delete template" title="Delete template" onClick={() => onDelete(tpl.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><Trash2 size={13} /></button>
    </div>
    {tpl.subject && <p className="text-xs text-gray-500 font-medium">Subject: {tpl.subject}</p>}
    <p className="text-xs text-gray-400 line-clamp-2">{tpl.body}</p>
  </div>
);

const CampaignCard = ({
  campaign,
  onLaunch,
  onDelete,
}: {
  campaign: OutreachCampaignView;
  onLaunch: (id: string) => void;
  onDelete: (id: string) => void;
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-gray-900">{campaign.name}</p>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${STATUS_STYLES[campaign.status]}`}>{campaign.status}</span>
          <span className="flex items-center gap-1 text-[11px] text-gray-400">{CHANNEL_ICON[campaign.channel]} {campaign.channel}</span>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {[
            { label: 'Sent', value: `${campaign.sentMessages}/${campaign.totalMessages}` },
            { label: 'Open rate', value: pct(campaign.openRate) },
            { label: 'Reply rate', value: pct(campaign.replyRate) },
          ].map(metric => (
            <div key={metric.label}>
              <p className="text-[10px] text-gray-400">{metric.label}</p>
              <p className="text-sm font-bold text-gray-900">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {campaign.status === 'draft' && (
          <button onClick={() => onLaunch(campaign.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors">
            <Play size={11} /> Launch
          </button>
        )}
        <button aria-label="Delete campaign" title="Delete campaign" onClick={() => onDelete(campaign.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  </div>
);

const OutreachPage = () => {
  const [campaigns, setCampaigns] = useState<OutreachCampaignView[]>([]);
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await outreachApi.listCampaigns();
        setCampaigns(response.campaigns.map(toCampaignView));
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleLaunch = async (id: string) => {
    try {
      const updated = toCampaignView(await outreachApi.launchCampaign(id));
      if (!updated) return;

      setCampaigns(prev => prev.map(campaign => campaign.id === id ? { ...updated, status: 'active' } : campaign));
      toast.success('Campaign launched!');
    } catch {
      toast.error('Failed to launch campaign.');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('Delete this campaign?')) return;

    try {
      await outreachApi.deleteCampaign(id);
      setCampaigns(prev => prev.filter(campaign => campaign.id !== id));
      toast.success('Campaign deleted.');
    } catch {
      toast.error('Failed to delete campaign.');
    }
  };

  const handleDeleteTemplate = async (_id: string) => {
    toast.error('Template management is not available with the current backend yet.');
  };

  if (loading) {
    return <PageLoader />;
  }

  const activeCampaigns = campaigns.filter(campaign => campaign.status === 'active').length;
  const totalSent = campaigns.reduce((sum, campaign) => sum + campaign.sentMessages, 0);
  const campaignsWithReplyRate = campaigns.filter(campaign => campaign.replyRate !== null);
  const avgReplyRate = campaignsWithReplyRate.length
    ? campaignsWithReplyRate.reduce((sum, campaign) => sum + (campaign.replyRate ?? 0), 0) / campaignsWithReplyRate.length
    : 0;

  return (
    <>
      <PageMeta title="Outreach - CareerOps" />
      {showModal && (
        <CreateCampaignModal
          templates={templates}
          onClose={() => setShowModal(false)}
          onCreate={campaign => setCampaigns(prev => [campaign, ...prev])}
        />
      )}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Outreach</h1>
            <p className="text-sm text-gray-500 mt-1">Run targeted campaigns to recruiters and hiring managers.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={15} /> New Campaign
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Campaigns', value: activeCampaigns, icon: <Play size={15} /> },
            { label: 'Messages Sent', value: totalSent, icon: <Send size={15} /> },
            { label: 'Avg Reply Rate', value: `${Math.round(avgReplyRate * 100)}%`, icon: <BarChart2 size={15} /> },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{stat.icon}</div>
              <div>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                <p className="text-[10px] text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex border-b border-gray-200">
          {(['campaigns', 'templates'] as const).map(currentTab => (
            <button
              key={currentTab}
              onClick={() => setTab(currentTab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
                tab === currentTab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {currentTab === 'campaigns' ? `Campaigns (${campaigns.length})` : `Templates (${templates.length})`}
            </button>
          ))}
        </div>

        {tab === 'campaigns' && (
          <div className="space-y-3">
            {campaigns.length > 0 ? (
              campaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} onLaunch={handleLaunch} onDelete={handleDeleteCampaign} />)
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
                <Send size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No campaigns yet. Create your first to start reaching out.</p>
              </div>
            )}
          </div>
        )}

        {tab === 'templates' && (
          <div className="space-y-3">
            {templates.length > 0 ? (
              templates.map(template => <TemplateCard key={template.id} tpl={template} onDelete={handleDeleteTemplate} />)
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">
                  Template management is not exposed by the current backend contract yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default OutreachPage;