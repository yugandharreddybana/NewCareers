import React, { useEffect, useRef, useState } from 'react';

interface Props {
  isOpen: boolean;
  skillName: string;
  question: string;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  isLoading: boolean;
}

/**
 * Modal shown when Claude calls ask_user mid-skill.
 * Displays Claude's question and collects the user's answer.
 *
 * Accessibility:
 *  - role="dialog" with aria-modal
 *  - focus trapped inside while open
 *  - ESC to skip (same as clicking Skip)
 *  - auto-focuses the textarea on open
 */
export function SkillQuestionModal({
  isOpen,
  skillName,
  question,
  onSubmit,
  onSkip,
  isLoading,
}: Props) {
  const [answer, setAnswer] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 50);
      setAnswer('');
    }
  }, [isOpen]);

  // ESC key → skip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) onSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isLoading, onSkip]);

  if (!isOpen) return null;

  const skillLabel = skillName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const handleSubmit = () => {
    if (!isLoading) onSubmit(answer.trim());
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget && !isLoading) onSkip(); }}
    >
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-question-title"
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
            {skillLabel}
          </span>
          <h2
            id="skill-question-title"
            className="text-sm font-semibold text-gray-500 dark:text-gray-400"
          >
            Needs your input
          </h2>
        </div>

        {/* Question */}
        <p className="text-base font-medium text-gray-900 dark:text-white mb-4 leading-relaxed">
          {question}
        </p>

        {/* Answer textarea */}
        <textarea
          ref={textareaRef}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
          disabled={isLoading}
          rows={4}
          placeholder="Type your answer here... (Ctrl+Enter to submit)"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onSkip}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || answer.trim().length === 0}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                </svg>
                Processing...
              </>
            ) : 'Continue'}
          </button>
        </div>

        {/* Hint */}
        <p className="mt-3 text-xs text-gray-400 text-center">
          You can skip this question — CareerOps will continue with available information.
        </p>
      </div>
    </div>
  );
}

export default SkillQuestionModal;
