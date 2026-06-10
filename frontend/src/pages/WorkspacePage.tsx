import React, { useEffect, useState } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { PageLoader } from '@/components/LoadingSpinner';
import { workspaceApi, type Workspace } from '@/services/workspaceApi';
import toast from 'react-hot-toast';
import { Briefcase, Plus, Users, Crown, X } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

const memberLabel = (member: Workspace['members'][number]): string => {
  return member.invitedEmail ?? member.userId ?? 'Pending member';
};

const CreateModal: React.FC<{ onClose: () => void; onCreate: (w: Workspace) => void }> = ({ onClose, onCreate }) => {
  const [name, setName]   = useState('');
  const [desc, setDesc]   = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Workspace name required.'); return; }
    setSaving(true);
    try {
      const w = await workspaceApi.create({ name, ...(desc ? { description: desc } : {}) });
      onCreate(w); toast.success('Workspace created!'); onClose();
    } catch { toast.error('Failed to create workspace.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-base font-bold text-gray-900">New Workspace</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Interview Prep Team" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
        <div><label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Optional description" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" /></div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
};

const WorkspacePage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadWorkspaces = async () => {
    setLoadFailed(false);
    setLoading(true);
    try {
      const data = await workspaceApi.list();
      setWorkspaces(data);
    } catch {
      setLoadFailed(true);
      toast.error('Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  if (loading) return <PageLoader />;

  if (loadFailed) return (
    <>
      <PageMeta title="Workspace — NewCareers" />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <EmptyState
          icon={<Briefcase size={28} className="text-slate-300" />}
          message="Could not load workspaces"
          description="The workspace service did not respond. Try again."
          cta="Retry"
          onCta={() => { void loadWorkspaces(); }}
        />
      </div>
    </>
  );

  return (
    <>
      <PageMeta title="Workspace — NewCareers" />
      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreate={w => setWorkspaces(p => [w, ...p])} />}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold text-gray-900">Workspaces</h1><p className="text-sm text-gray-500 mt-1">Shared spaces to collaborate with peers or coaches on your job search.</p></div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"><Plus size={15} /> New Workspace</button>
        </div>

        {workspaces.length > 0 ? (
          <div className="space-y-4">
            {workspaces.map(w => (
              <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><Briefcase size={18} /></div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{w.name}</p>
                      {w.description && <p className="text-xs text-gray-500 mt-0.5">{w.description}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">Created {new Date(w.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
                {w.members.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><Users size={12} /> Members ({w.members.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {w.members.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                          {m.role === 'owner' && <Crown size={11} className="text-amber-500" />}
                          {memberLabel(m)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {w.members.length === 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-400">No members yet. Invite collaborators to get started.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Briefcase size={28} className="text-slate-300" />}
            message="No workspaces yet"
            description="Create a shared workspace to collaborate with interview buddies or a career coach."
            cta="New Workspace"
            onCta={() => setShowModal(true)}
          />
        )}
      </div>
    </>
  );
};

export default WorkspacePage;
