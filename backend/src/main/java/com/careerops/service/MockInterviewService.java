package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.repository.InterviewQuestionBankRepository;
import com.careerops.repository.InterviewSessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 3.1 — Mock Interview Service
 *
 * Runs turn-by-turn text-based mock interviews.
 * Each reply is scored by Gemini and stored in interview_question_bank.
 * When all questions are answered, the session is completed with a summary.
 */
@Service
public class MockInterviewService {

    private final InterviewSessionRepository sessionRepo;
    private final InterviewQuestionBankRepository questionRepo;
    private final GeminiService gemini;

    public MockInterviewService(InterviewSessionRepository sessionRepo,
                                 InterviewQuestionBankRepository questionRepo,
                                 GeminiService gemini) {
        this.sessionRepo = sessionRepo;
        this.questionRepo = questionRepo;
        this.gemini = gemini;
    }

    // ── Start a new mock interview session ────────────────────────────────────
    @Transactional
    public Map<String, Object> start(UUID userId, UUID userJobId, UUID trackId) {
        // Load kit questions for this job
        List<InterviewQuestionBank> kit = questionRepo.findByUserJobIdOrderByCreatedAtDesc(userJobId);
        if (kit.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST,
                "Generate an interview kit first before starting a mock session.");

        InterviewSession session = sessionRepo.save(
            InterviewSession.builder()
                .userId(userId)
                .userJobId(userJobId)
                .trackId(trackId)
                .mode("text")
                .status("in_progress")
                .build()
        );

        // Return session + first question
        InterviewQuestionBank first = kit.get(kit.size() - 1); // oldest question first
        return Map.of(
            "sessionId", session.getId(),
            "totalQuestions", kit.size(),
            "currentTurn", 0,
            "question", first.getQuestion(),
            "questionId", first.getId(),
            "skillArea", first.getSkillArea() != null ? first.getSkillArea() : "general"
        );
    }

    // ── Submit a reply for scoring ─────────────────────────────────────────────
    @Transactional
    public Map<String, Object> reply(UUID userId, UUID sessionId, UUID questionId, String userAnswer) {
        InterviewSession session = sessionRepo.findById(sessionId)
            .filter(s -> s.getUserId().equals(userId))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Session not found"));

        if ("completed".equals(session.getStatus()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Session already completed");

        InterviewQuestionBank question = questionRepo.findById(questionId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Question not found"));

        // Score the answer via Gemini
        String scorePrompt = String.format("""
            Rate this interview answer on a scale of 0 to 10.
            Question: %s
            Model answer: %s
            Candidate answer: %s

            Respond ONLY with:
            SCORE: [0-10]
            FEEDBACK: [one sentence of constructive feedback]
            """, question.getQuestion(), question.getModelAnswer(), userAnswer);

        String aiResp = gemini.generate(scorePrompt);
        BigDecimal score = parseScore(aiResp);
        String feedback = parseFeedback(aiResp);

        question.setUserAnswer(userAnswer);
        question.setScore(score);
        questionRepo.save(question);

        // Check if all questions for this session's job are answered
        List<InterviewQuestionBank> allQs = questionRepo
            .findByUserJobIdOrderByCreatedAtDesc(session.getUserJobId());
        long answered = allQs.stream()
            .filter(q -> q.getUserAnswer() != null && !q.getUserAnswer().isBlank()).count();
        boolean done = answered >= allQs.size();

        if (done) {
            double avg = allQs.stream()
                .filter(q -> q.getScore() != null)
                .mapToDouble(q -> q.getScore().doubleValue())
                .average().orElse(0);
            session.setOverallScore(BigDecimal.valueOf(avg));
            session.setStatus("completed");
            session.setCompletedAt(Instant.now());
            sessionRepo.save(session);
        }

        // Determine next question
        InterviewQuestionBank next = allQs.stream()
            .filter(q -> q.getUserAnswer() == null || q.getUserAnswer().isBlank())
            .findFirst().orElse(null);

        return Map.of(
            "score", score,
            "feedback", feedback,
            "sessionComplete", done,
            "overallScore", done ? session.getOverallScore() : BigDecimal.ZERO,
            "nextQuestion", next != null ? next.getQuestion() : "",
            "nextQuestionId", next != null ? next.getId().toString() : "",
            "answeredCount", answered
        );
    }

    // ── Get session history for a job ─────────────────────────────────────────
    public List<InterviewSession> historyForJob(UUID userJobId) {
        return sessionRepo.findByUserJobIdOrderByStartedAtDesc(userJobId);
    }

    public List<InterviewSession> historyForUser(UUID userId) {
        return sessionRepo.findByUserIdOrderByStartedAtDesc(userId);
    }

    // ── Parse Gemini score response ───────────────────────────────────────────
    private BigDecimal parseScore(String resp) {
        if (resp == null) return BigDecimal.ZERO;
        for (String line : resp.split("\n")) {
            if (line.trim().startsWith("SCORE:")) {
                try {
                    return new BigDecimal(line.replace("SCORE:", "").trim());
                } catch (NumberFormatException ignored) {}
            }
        }
        return BigDecimal.ZERO;
    }

    private String parseFeedback(String resp) {
        if (resp == null) return "";
        for (String line : resp.split("\n")) {
            if (line.trim().startsWith("FEEDBACK:")) {
                return line.replace("FEEDBACK:", "").trim();
            }
        }
        return "";
    }
}
