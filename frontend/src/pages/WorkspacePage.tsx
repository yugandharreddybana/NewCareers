// Section 3.4 — Tasks 54, 55
// Main workspace collaboration page
import React, { useCallback, useEffect, useState } from 'react';
import { workspaceApi, Workspace, InvitePayload } from '../api/workspaceApi';
import { WorkspaceActivityFeed } from '../components/WorkspaceActivityFeed';

const ROLE_BADGE: Record<string, string> = {
  owner: 'badge--primary',
  mentor: 'badge--teal',
  reviewer: 'badge--gray',
};

export const WorkspacePage: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [inviteForm, setInviteForm] = useState<InvitePayload>({ email: '', role: 'reviewer' });
  const [copyToast, setCopyToast] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    workspaceApi.list().then(setWorkspaces).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ws = await workspaceApi.create(createForm);
      setWorkspaces(prev => [ws, ...prev]);
      setSelected(ws);
      setShowCreate(false);
      setCreateForm({ name: '', description: '' });
    } catch {
      setError('Failed to create workspace. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !inviteForm.email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await workspaceApi.invite(selected.id, inviteForm);
      const updated = await workspaceApi.get(selected.id);
      setSelected(updated);
      setWorkspaces(prev => prev.map(w => (w.id === updated.id ? updated : w)));
      setShowInvite(false);
      setInviteForm({ email: '', role: 'reviewer' });
    } catch {
      setError('Failed to send invite. Please check the email address and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Task 55 — copy shareable review link
  const copyShareLink = () => {
    if (!selected) return;
    const link = `${window.location.origin}/workspaces/invite/${selected.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton skeleton-heading" style={{ width: '200px' }} />
        </div>
        {[1, 2].map(i => (
          <div key={i} className="skeleton skeleton-card" style={{ height: '80px', marginBottom: '12px' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="page-container workspace-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Workspaces</h1>
          <p className="page-subtitle">Invite mentors and reviewers to collaborate on your applications.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Workspace
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="workspace-layout">
        {/* Sidebar — workspace list */}
        <aside className="workspace-sidebar">
          {workspaces.length === 0 ? (
            <div className="empty-state">
              <p>No workspaces yet.</p>
              <button className="btn btn-ghost" onClick={() => setShowCreate(true)}>Create one</button>
            </div>
          ) : (
            <ul className="workspace-list">
              {workspaces.map(ws => (
                <li
                  key={ws.id}
                  className={`workspace-list-item${selected?.id === ws.id ? ' workspace-list-item--active' : ''}`}
                  onClick={() => setSelected(ws)}
                >
                  <span className="ws-name">{ws.name}</span>
                  <span className="ws-count">{ws.members.length} member{ws.members.length !== 1 ? 's' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Main panel */}
        <main className="workspace-main">
          {!selected ? (
            <div className="empty-state">
              <p>Select a workspace or create a new one to get started.</p>
            </div>
          ) : (
            <>
              <div className="workspace-detail-header">
                <div>
                  <h2 className="ws-detail-name">{selected.name}</h2>
                  {selected.description && <p className="ws-detail-desc">{selected.description}</p>}
                </div>
                <div className="ws-actions">
                  {/* Task 55 — share review link */}
                  <button className="btn btn-ghost" onClick={copyShareLink}>
                    🔗 Copy Review Link
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
                    Invite Member
                  </button>
                </div>
              </div>

              {copyToast && (
                <div className="toast toast-success">Review link copied to clipboard!</div>
              )}

              {/* Member roster */}
              <section className="ws-members">
                <h3 className="section-label">Members</h3>
                <ul className="member-list">
                  {selected.members.map(m => (
                    <li key={m.id} className="member-item">
                      <div className="member-info">
                        <span className="member-email">{m.invitedEmail ?? 'You'}</span>
                        <span className={`badge ${ROLE_BADGE[m.role] ?? 'badge--gray'}`}>
                          {m.role}
                        </span>
                        {m.inviteStatus === 'pending' && (
                          <span className="badge badge--warning">Pending</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Activity feed — Task 57 */}
              <WorkspaceActivityFeed workspaceId={selected.id} />
            </>
          )}
        </main>
      </div>

      {/* Create Workspace Modal */}
      {showCreate && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Create workspace">
          <div className="modal">
            <div className="modal-header">
              <h2>New Workspace</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)} aria-label="Close">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="modal-body">
              <label className="form-label" htmlFor="ws-name">Name *</label>
              <input
                id="ws-name"
                className="form-input"
                value={createForm.name}
                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Senior Dev Job Search"
                required
              />
              <label className="form-label" htmlFor="ws-desc">Description</label>
              <textarea
                id="ws-desc"
                className="form-input"
                rows={3}
                value={createForm.description}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional — what is this workspace for?"
              />
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInvite && selected && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Invite member">
          <div className="modal">
            <div className="modal-header">
              <h2>Invite to "{selected.name}"</h2>
              <button className="modal-close" onClick={() => setShowInvite(false)} aria-label="Close">&times;</button>
            </div>
            <form onSubmit={handleInvite} className="modal-body">
              <label className="form-label" htmlFor="invite-email">Email address *</label>
              <input
                id="invite-email"
                type="email"
                className="form-input"
                value={inviteForm.email}
                onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                placeholder="mentor@example.com"
                required
              />
              <label className="form-label" htmlFor="invite-role">Role *</label>
              <select
                id="invite-role"
                className="form-input"
                value={inviteForm.role}
                onChange={e => setInviteForm(p => ({ ...p, role: e.target.value as 'mentor' | 'reviewer' }))}
              >
                <option value="mentor">Mentor — can comment and suggest edits</option>
                <option value="reviewer">Reviewer — can view and comment only</option>
              </select>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspacePage;
