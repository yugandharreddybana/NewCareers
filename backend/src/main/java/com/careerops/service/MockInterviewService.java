package com.careerops.service;

import com.careerops.model.InterviewSession;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.InterviewTrackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Task 8 — MockInterviewService
 * Runs text-based mock interviews with turn-by-turn AI scoring.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MockInterviewService {

    private final InterviewSessionRepository sessionRepo;
    private final InterviewTrackRepository trackRepo;
    private final GeminiService geminiService;

    /** Task 10 — Start a new mock session */
    public InterviewSession startSession(UUID userJobId, UUID userId) {
        InterviewSession session = new InterviewSession();
        session.setId(UUID.randomUUID());
        session.setUserJobId(userJobId);
        session.setUserId(userId);
        session.setMode("TEXT");
        session.setStatus("ACTIVE");
        session.setScore(0);
        session.setTurnCount(0);
        session.setStartedAt(LocalDateTime.now());

        // Generate the opening question
        String opening = geminiService.generateContent(
            "You are a professional interviewer. Start a mock interview with a warm greeting and your first question. " +
            "Keep it concise. Do not repeat the question number. Just ask the first question naturally."
        );
        session.setCurrentQuestion(opening);
        session.setTranscriptJson("[]");
        return sessionRepo.save(session);
    }

    /** Task 11 — Process a user reply, score it, generate next question */
    public InterviewSession processReply(UUID sessionId, UUID userId, String userAnswer) {
        InterviewSession session = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        if (!session.getUserId().equals(userId)) {
            throw new SecurityException("Access denied to session: " + sessionId);
        }
        if (!"ACTIVE".equals(session.getStatus())) {
            throw new IllegalStateException("Session is not active.");
        }

        int turn = session.getTurnCount() + 1;

        // Score the answer
        String scorePrompt = String.format(
            """The interviewer asked: \"%s\"
            The candidate answered: \"%s\"
            Score this answer from 0-10 and provide 2 specific improvement tips.
            Return JSON: {\"score\":0,\"tips\":[\"\",\"\"]}""",
            session.getCurrentQuestion(), userAnswer
        );
        String scoreJson = geminiService.generateContent(scorePrompt);

        // Update running score (parse or default)
        int answerScore = extractScore(scoreJson);
        int newScore = ((session.getScore() * (turn - 1)) + answerScore) / turn; // rolling avg

        // Build transcript entry
        String transcriptEntry = String.format(
            "{\"turn\":%d,\"question\":\"%s\",\"answer\":\"%s\",\"scoreData\":%s}",
            turn,
            escapeJson(session.getCurrentQuestion()),
            escapeJson(userAnswer),
            scoreJson
        );
        String transcript = appendToTranscript(session.getTranscriptJson(), transcriptEntry);

        // Generate next question or close session after 8 turns
        String nextQuestion;
        String status = session.getStatus();
        if (turn >= 8) {
            nextQuestion = "That concludes our mock interview. Thank you for your answers! Check your score summary below.";
            status = "COMPLETED";
            session.setCompletedAt(LocalDateTime.now());
        } else {
            nextQuestion = geminiService.generateContent(
                "Continue the mock interview. The candidate just answered the previous question. " +
                "Ask the next relevant interview question. Keep it natural and professional."
            );
        }

        session.setTurnCount(turn);
        session.setScore(newScore);
        session.setCurrentQuestion(nextQuestion);
        session.setTranscriptJson(transcript);
        session.setStatus(status);
        return sessionRepo.save(session);
    }

    /** Task 12 — Get session history for a job */
    public List<InterviewSession> getHistory(UUID userJobId, UUID userId) {
        return sessionRepo.findByUserJobIdAndUserId(userJobId, userId);
    }

    // ---- helpers ----

    private int extractScore(String json) {
        try {
            int idx = json.indexOf("\"score\":");
            if (idx < 0) return 5;
            String sub = json.substring(idx + 8).trim();
            StringBuilder num = new StringBuilder();
            for (char c : sub.toCharArray()) {
                if (Character.isDigit(c)) num.append(c);
                else break;
            }
            return num.length() > 0 ? Integer.parseInt(num.toString()) : 5;
        } catch (Exception e) {
            return 5;
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }

    private String appendToTranscript(String existing, String newEntry) {
        if (existing == null || existing.equals("[]")) return "[" + newEntry + "]";
        return existing.substring(0, existing.length() - 1) + "," + newEntry + "]";
    }
}
