// Section 3.4 — Task 56
// Inline commenting panel for cover letter drafts and tailored CV content
import React, { useEffect, useRef, useState } from 'react';
import { workspaceApi, type WorkspaceNote } from '@/services/workspaceApi';

const NOTES_POLL_INTERVAL_MS = 30_000;

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
    let active = true;

    const refreshNotes = async (showSpinner = false) => {
      if (showSpinner) setLoading(true);

      try {
        const all = await workspaceApi.getNotes(workspaceId);
        if (!active) return;

        setNotes(
          all.filter(note => note.targetType === targetType && note.targetId === targetId)
        );
      } finally {
        if (active && showSpinner) {
          setLoading(false);
        }
      }
    };

    void refreshNotes(true);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotes();
      }
    };

    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshNotes();
      }
    }, NOTES_POLL_INTERVAL_MS);

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(pollId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
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
            <div
              key={i}
              className={`skeleton skeleton-text ${i === 1 ? 'thread-skeleton-line--wide' : 'thread-skeleton-line--narrow'}`}
            />
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
