// Section 3.4 — Task 57
// Activity feed: recent notes, members joining, document edits
import React, { useEffect, useState } from 'react';
import { workspaceApi, type WorkspaceNote } from '@/services/workspaceApi';

interface Props {
  workspaceId: string;
  pollIntervalMs?: number;
}

const ICONS: Record<string, string> = {
  cover_letter: '📝',
  cv_section: '📄',
  job: '💼',
  general: '💬',
};

export const WorkspaceActivityFeed: React.FC<Props> = ({
  workspaceId,
  pollIntervalMs = 30_000,
}) => {
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchNotes = () =>
    workspaceApi.getNotes(workspaceId).then(setNotes).catch(console.error);

  useEffect(() => {
    setLoading(true);
    fetchNotes().finally(() => setLoading(false));
    const id = setInterval(fetchNotes, pollIntervalMs);
    return () => clearInterval(id);
  }, [workspaceId, pollIntervalMs]);

  const filtered =
    filter === 'all' ? notes : notes.filter(n => n.targetType === filter);

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'cover_letter', label: 'Cover Letters' },
    { value: 'cv_section', label: 'CV Sections' },
    { value: 'job', label: 'Jobs' },
    { value: 'general', label: 'General' },
  ];

  return (
    <section className="activity-feed">
      <div className="feed-header">
        <h3 className="feed-title">Activity</h3>
        <div className="feed-filters">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`filter-chip${filter === opt.value ? ' filter-chip--active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ul className="feed-list">
          {[1, 2, 3].map(i => (
            <li key={i} className="feed-item">
              <div className="skeleton skeleton-text" style={{ width: '70%' }} />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <p className="feed-empty">No activity yet in this workspace.</p>
      ) : (
        <ul className="feed-list">
          {filtered.map(note => (
            <li key={note.id} className="feed-item">
              <span className="feed-icon">
                {ICONS[note.targetType ?? 'general'] ?? '💬'}
              </span>
              <div className="feed-body">
                <p className="feed-content">{note.content}</p>
                <span className="feed-meta">
                  {note.targetType
                    ? `On ${note.targetType.replace('_', ' ')}`
                    : 'General note'}{' '}
                  &bull;{' '}
                  {new Date(note.createdAt).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
