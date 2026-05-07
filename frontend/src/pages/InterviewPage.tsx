/**
 * InterviewPage.tsx — Phase 3.1
 *
 * Entry point for Interview Command Center.
 * Shows kit generation + mock interview flow for a selected job.
 * Falls back to browsing all sessions if no jobId is provided.
 */
import { useState } from 'react';
import InterviewKitPanel from '../components/interview/InterviewKitPanel';
import MockInterviewPanel from '../components/interview/MockInterviewPanel';

interface MockState {
  sessionId: string;
  firstQuestion: string;
  firstQuestionId: string;
}

export default function InterviewPage() {
  const [mock, setMock] = useState<MockState | null>(null);

  // In production this would come from useSearchParams() or route params
  const userJobId = new URLSearchParams(window.location.search).get('jobId') ?? '';
  const companyName = new URLSearchParams(window.location.search).get('company') ?? '';
  const roleTitle   = new URLSearchParams(window.location.search).get('role')    ?? '';

  if (!userJobId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-sm">
          Open a job and click the Interview tab to use the Interview Command Center.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interview Command Center</h1>
        {companyName && (
          <p className="text-gray-500 text-sm mt-1">{companyName} · {roleTitle}</p>
        )}
      </div>

      {!mock ? (
        <InterviewKitPanel
          userJobId={userJobId}
          companyName={companyName}
          roleTitle={roleTitle}
          onStartMock={(sessionId, firstQuestion, firstQuestionId) =>
            setMock({ sessionId, firstQuestion, firstQuestionId })
          }
        />
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setMock(null)}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to Kit
          </button>
          <MockInterviewPanel
            sessionId={mock.sessionId}
            firstQuestion={mock.firstQuestion}
            firstQuestionId={mock.firstQuestionId}
            onComplete={(score) => console.log('Session complete, score:', score)}
          />
        </div>
      )}
    </div>
  );
}
