import { useState } from 'react';
import { type CreateContactPayload, networkingApi } from '@/api/networkingApi';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function AddContactModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<CreateContactPayload>({
    name: '',
    email: '',
    linkedinUrl: '',
    company: '',
    roleTitle: '',
    contactType: 'recruiter',
    relationshipTemperature: 'cold',
    pipelineStage: 'identified',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof CreateContactPayload, v: string) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      setSaving(true);
      await networkingApi.createContact(form);
      toast.success('Contact added');
      onCreated();
      onClose();
    } catch {
      toast.error('Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text">Add Contact</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input className="input" placeholder="Full name *" value={form.name} onChange={e => set('name', e.target.value)} />
          <input className="input" placeholder="Email" value={form.email} onChange={e => set('email', e.target.value)} />
          <input className="input" placeholder="LinkedIn URL" value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} />
          <input className="input" placeholder="Company" value={form.company} onChange={e => set('company', e.target.value)} />
          <input className="input" placeholder="Job title" value={form.roleTitle} onChange={e => set('roleTitle', e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Contact type</label>
              <select className="input" value={form.contactType} onChange={e => set('contactType', e.target.value)}>
                <option value="recruiter">Recruiter</option>
                <option value="hiring_manager">Hiring Manager</option>
                <option value="alumni">Alumni</option>
                <option value="referral">Referral</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Temperature</label>
              <select className="input" value={form.relationshipTemperature} onChange={e => set('relationshipTemperature', e.target.value)}>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Pipeline stage</label>
            <select className="input" value={form.pipelineStage} onChange={e => set('pipelineStage', e.target.value)}>
              <option value="identified">Identified</option>
              <option value="connected">Connected</option>
              <option value="outreached">Outreached</option>
              <option value="replied">Replied</option>
              <option value="meeting_scheduled">Meeting Booked</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <textarea className="input resize-none" rows={3} placeholder="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} />

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Add Contact'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
