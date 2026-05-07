// Task 27 — DeadlineTimeline: visual vertical timeline of deadline events for a job or dashboard
import React, { useEffect, useState } from 'react';
import { api as axios } from '@/services/api';

interface DeadlineEvent {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  notes: string | null;
}

interface Props {
  userJobId?: string;  // if provided, shows job-specific deadlines
                       // if omitted, shows all upcoming deadlines for user
}

const EVENT_ICON: Record<string, string> = {
  APPLICATION_CLOSE: '📅',
  INTERVIEW:         '🎤',
  FOLLOW_UP:         '💬',
  OFFER_DEADLINE:    '🏆',
  ASSESSMENT:        '📝',
  CUSTOM:            '🔖',
};

const isPast = (dateStr: string) => new Date(dateStr) < new Date();

export const DeadlineTimeline: React.FC<Props> = ({ userJobId }) => {
  const [events, setEvents]       = useState<DeadlineEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [addOpen, setAddOpen]     = useState(false);
  const [form, setForm]           = useState({ title: '', eventType: 'CUSTOM', eventDate: '', notes: '' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    const url = userJobId
      ? `/planner/deadlines/${userJobId}`
      : '/planner/deadlines/upcoming';
    axios.get<DeadlineEvent[]>(url)
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userJobId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userJobId || !form.title || !form.eventDate) return;
    setSaving(true);
    try {
      const r = await axios.post<DeadlineEvent>(`/planner/deadlines/${userJobId}`, {
        ...form,
        eventDate: new Date(form.eventDate).toISOString(),
      });
      setEvents(prev => [...prev, r.data].sort(
        (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
      ));
      setAddOpen(false);
      setForm({ title: '', eventType: 'CUSTOM', eventDate: '', notes: '' });
    } catch {
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="deadline-timeline">
      {[1,2,3].map(i => <div key={i} className="skeleton skeleton-text" style={{ height: '56px', marginBottom: '12px' }} />)}
    </div>
  );

  return (
    <div className="deadline-timeline" aria-label="Deadline Timeline">
      <div className="deadline-timeline__header">
        <h3 className="deadline-timeline__title">📅 Deadlines</h3>
        {userJobId && (
          <button className="btn btn-secondary btn-sm" onClick={() => setAddOpen(o => !o)}>
            {addOpen ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {addOpen && (
        <form className="deadline-add-form" onSubmit={handleAdd}>
          <input
            className="form-input"
            placeholder="Event title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
          />
          <select
            className="form-input"
            value={form.eventType}
            onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}
          >
            {['APPLICATION_CLOSE','INTERVIEW','FOLLOW_UP','OFFER_DEADLINE','ASSESSMENT','CUSTOM']
              .map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <input
            className="form-input"
            type="datetime-local"
            value={form.eventDate}
            onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
            required
          />
          <input
            className="form-input"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Deadline'}
          </button>
        </form>
      )}

      {events.length === 0 && (
        <div className="deadline-timeline__empty">
          <span>No deadlines yet{userJobId ? ' for this job' : ' in the next 30 days'}.</span>
        </div>
      )}

      <ol className="timeline-list" role="list">
        {events.map((ev, i) => (
          <li key={ev.id} className={`timeline-item${isPast(ev.eventDate) ? ' timeline-item--past' : ''}`}>
            <div className="timeline-item__dot" aria-hidden="true" />
            <div className="timeline-item__content">
              <span className="timeline-item__icon">{EVENT_ICON[ev.eventType] || '🔖'}</span>
              <div className="timeline-item__body">
                <p className="timeline-item__title">{ev.title}</p>
                <p className="timeline-item__date">
                  {new Date(ev.eventDate).toLocaleDateString('en-IE', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
                {ev.notes && <p className="timeline-item__notes">{ev.notes}</p>}
              </div>
            </div>
            {i < events.length - 1 && <div className="timeline-item__line" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
};
