// Section 3.4 — Task 56
// Inline commenting panel for cover letter drafts and tailored CV content
import React, { useEffect, useRef, useState } from 'react';
import { workspaceApi, WorkspaceNote } from '../api/workspaceApi';

interface Props {
  workspaceId: string;
  targetType: 'cover_letter' | 'cv_section';
  targetId: string;
  currentUserId: string;
}

export const InlineCommentThread: React.FC<Props> = ({
  workspaceId,
  targetType,
  targetId,
  currentUserId,
}) => {
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    workspaceApi
      .getNotes(workspaceId)
      .then(all =>
        setNotes(
          all.filter(n => n.targetType === targetType && n.targetId === targetId)
        )
      )
      .finally(() => setLoading(false));
  }, [workspaceId, targetType, targetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const note = await workspaceApi.addNote(workspaceId, {
        targetType,
        targetId,
        content: newComment.trim(),
      });
      setNotes(prev => [...prev, note]);
      setNewComment('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="inline-comment-thread">
      <h4 className="thread-heading">Comments</h4>

      {loading ? (
        <div className="thread-skeleton">
          {[1, 2].map(i => (
            <div key={i} className="skeleton skeleton-text" style={{ width: i === 1 ? '80%' : '60%' }} />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="thread-empty">No comments yet. Be the first to leave feedback.</p>
      ) : (
        <ul className="thread-list">
          {notes.map(note => (
            <li
              key={note.id}
              className={`thread-item${note.resolved ? ' thread-item--resolved' : ''}`}
            >
              <div className="thread-item-meta">
                <span className="thread-author">
                  {note.authorId === currentUserId ? 'You' : 'Reviewer'}
                </span>
                <span className="thread-time">
                  {new Date(note.createdAt).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {note.resolved && <span className="resolved-badge">Resolved</span>}
              </div>
              <p className="thread-content">{note.content}</p>
            </li>
          ))}
        </ul>
      )}
      <div ref={bottomRef} />

      <form onSubmit={handleSubmit} className="thread-form">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
          disabled={submitting}
          className="thread-textarea"
        />
        <button
          type="submit"
          disabled={submitting || !newComment.trim()}
          className="btn btn-primary btn-sm"
        >
          {submitting ? 'Posting…' : 'Post Comment'}
        </button>
      </form>
    </aside>
  );
};
