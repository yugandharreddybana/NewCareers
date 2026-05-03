/**
 * MockInterviewPanel.tsx — Phase 3.1
 *
 * Conversational mock interview UI with live score badges.
 * Receives initial session data from InterviewKitPanel and runs turn-by-turn.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { interviewApi, MockReplyResponse } from '../../services/interviewApi';

interface Turn {
  question: string;
  answer?: string;
  score?: number;
  feedback?: string;
}

interface Props {
  sessionId: string;
  firstQuestion: string;
  firstQuestionId: string;
  onComplete?: (overallScore: number) => void;
}

export default function MockInterviewPanel({
  sessionId, firstQuestion, firstQuestionId, onComplete,
}: Props) {
  const [turns, setTurns] = useState<Turn[]>([{ question: firstQuestion }]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [currentQuestionId, setCurrentQuestionId] = useState(firstQuestionId);
  const [isComplete, setIsComplete] = useState(false);
  const [finalScore, setFinalScore] = useState<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const replyMutation = useMutation({
    mutationFn: (answer: string) =>
      interviewApi.replyMock(sessionId, currentQuestionId, answer),
    onSuccess: (data: MockReplyResponse) => {
      setTurns(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          answer: currentAnswer,
          score: data.score,
          feedback: data.feedback,
        };
        if (!data.sessionComplete && data.nextQuestion) {
          updated.push({ question: data.nextQuestion });
        }
        return updated;
      });
      setCurrentAnswer('');
      if (data.sessionComplete) {
        setIsComplete(true);
        setFinalScore(data.overallScore);
        onComplete?.(data.overallScore);
      } else {
        setCurrentQuestionId(data.nextQuestionId);
      }
    },
  });

  const handleSubmit = () => {
    if (!currentAnswer.trim() || replyMutation.isPending) return;
    replyMutation.mutate(currentAnswer.trim());
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-800">Mock Interview</h3>
        <span className="text-xs text-gray-500">{turns.length} question{turns.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {turns.map((turn, idx) => (
          <div key={idx} className="space-y-2">
            {/* Question */}
            <div className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                AI
              </span>
              <div className="bg-indigo-50 rounded-xl rounded-tl-none px-4 py-3 text-sm text-gray-800 max-w-prose">
                {turn.question}
              </div>
            </div>

            {/* Answer */}
            {turn.answer && (
              <div className="flex gap-3 justify-end">
                <div className="bg-white border border-gray-200 rounded-xl rounded-tr-none px-4 py-3 text-sm text-gray-800 max-w-prose">
                  {turn.answer}
                </div>
                {turn.score != null && (
                  <span className={`shrink-0 self-end mb-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    turn.score >= 7 ? 'bg-green-100 text-green-700'
                    : turn.score >= 4 ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                    {turn.score}/10
                  </span>
                )}
              </div>
            )}

            {/* Feedback */}
            {turn.feedback && (
              <p className="ml-10 text-xs text-gray-500 italic">{turn.feedback}</p>
            )}
          </div>
        ))}

        {isComplete && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <p className="text-sm font-semibold text-green-800">Session complete!</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{finalScore.toFixed(1)} / 10</p>
            <p className="text-xs text-green-600 mt-1">Overall score</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!isComplete && (
        <div className="px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg">
          <div className="flex gap-2">
            <textarea
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
              placeholder="Type your answer… (⌘ + Enter to submit)"
              rows={3}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSubmit}
              disabled={!currentAnswer.trim() || replyMutation.isPending}
              className="self-end px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {replyMutation.isPending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
