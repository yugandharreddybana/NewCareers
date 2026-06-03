package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.exception.ApiException;
import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.Notification;
import com.careerops.model.UserJob;
import com.careerops.repository.InterviewQuestionBankRepository;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.NotificationRepository;
import com.careerops.repository.UserJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Phase 3.1 — Mock Interview Service
 *
 * Batch 3 update:
 *  - generateInterviewKitAsync() runs the heavy Gemini call in a background
 *    @Async worker and notifies via NotificationRepository when done.
 *    The controller returns 202 Accepted immediately; client polls or listens
 *    on the SSE notification stream.
 *  - start() and reply() remain synchronous (they are fast DB + light AI calls).
 *  - AiProviderMetricsService is used to record Gemini latency/failures.
 */
@Service
@Slf4j
public class MockInterviewService {

    private final InterviewSessionRepository sessionRepo;
    private final InterviewQuestionBankRepository questionRepo;
    private final UserJobRepository userJobRepo;
    private final NotificationRepository notificationRepo;
    private final GeminiService gemini;
    private final AiProviderMetricsService aiMetrics;

    public MockInterviewService(InterviewSessionRepository sessionRepo,
                                 InterviewQuestionBankRepository questionRepo,
                                 UserJobRepository userJobRepo,
                                 NotificationRepository notificationRepo,
                                 GeminiService gemini,
                                 AiProviderMetricsService aiMetrics) {
        this.sessionRepo = sessionRepo;
        this.questionRepo = questionRepo;
        this.userJobRepo = userJobRepo;
        this.notificationRepo = notificationRepo;
        this.gemini = gemini;
        this.aiMetrics = aiMetrics;
    }

    // ── Batch 3: Async interview kit generation ────────────────────────────────

    /**
     * Batch 3: Generate the interview question kit in the background.
     * Returns a CompletableFuture immediately — the caller should return 202 Accepted.
     *
     * On success: saves questions and pushes a MOCK_INTERVIEW_KIT_READY notification.
     * On failure: pushes a MOCK_INTERVIEW_KIT_FAILED notification.
     *
     * @param userId    user requesting the kit
     * @param userJobId the job to generate questions for
     * @param jobTitle  job title (passed in so we don't need a DB lookup in the async thread)
     * @param jobDesc   job description snippet
     * @param cvSummary user CV summary
     */
    @Async("skillExecutor")
    public CompletableFuture<List<InterviewQuestionBank>> generateInterviewKitAsync(
            UUID userId,
            UUID userJobId,
            String jobTitle,
            String jobDesc,
            String cvSummary) {

        log.info("[MockInterviewAsync] Generating kit for userJobId={} userId={}", userJobId, userId);
        try {
            List<InterviewQuestionBank> questions =
                    generateInterviewKit(userId, userJobId, jobTitle, jobDesc, cvSummary);
            pushNotification(userId, userJobId, "MOCK_INTERVIEW_KIT_READY",
                    "Your interview kit is ready!",
                    "AI has generated " + questions.size() + " questions for \"" + jobTitle + "\".");
            log.info("[MockInterviewAsync] Kit complete: {} questions for userJobId={}",
                    questions.size(), userJobId);
            return CompletableFuture.completedFuture(questions);
        } catch (Exception e) {
            log.error("[MockInterviewAsync] Failed for userJobId={}: {}", userJobId, e.getMessage());
            pushNotification(userId, userJobId, "MOCK_INTERVIEW_KIT_FAILED",
                    "Interview kit could not be generated",
                    "Please try again. Error: " + e.getMessage());
            return CompletableFuture.failedFuture(e);
        }
    }

    /**
     * Synchronous kit generation — used internally and by tests.
     * Calls Gemini to produce N interview questions with model answers.
     */
    public List<InterviewQuestionBank> generateInterviewKit(
            UUID userId,
            UUID userJobId,
            String jobTitle,
            String jobDesc,
            String cvSummary) {

        String prompt = String.format("""
                You are an expert technical and behavioural interview coach.
                Generate 8 interview questions for the following role.

                Job title: %s
                Job description (excerpt): %.600s
                Candidate CV summary: %.400s

                For each question provide:
                - question (the interview question text)
                - modelAnswer (2-3 sentence ideal answer)
                - skillArea (one of: TECHNICAL, BEHAVIOURAL, SITUATIONAL, CULTURE_FIT)

                Return as a JSON array:
                [{"question":"","modelAnswer":"","skillArea":""}]
                """,
                jobTitle,
                jobDesc != null ? jobDesc : "",
                cvSummary != null ? cvSummary : ""
        );

        long startMs = System.currentTimeMillis();
        String aiResponse;
        try {
            aiResponse = gemini.generate(prompt, userId, "mock-interview-kit");
            aiMetrics.recordSuccess("gemini", System.currentTimeMillis() - startMs);
        } catch (Exception e) {
            aiMetrics.recordFailure("gemini");
            throw new RuntimeException("Gemini failed to generate interview kit: " + e.getMessage(), e);
        }

        return parseAndSaveQuestions(userId, userJobId, aiResponse);
    }

    // ── Start a new mock interview session ────────────────────────────────────
    @Transactional(timeout = 10)
    public Map<String, Object> start(UUID userId, UUID userJobId, UUID trackId) {
        UserJob userJob = userJobRepo.findById(userJobId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "UserJob not found"));
        if (!userJob.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "UserJob not found");
        }

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

        InterviewQuestionBank first = kit.get(kit.size() - 1);
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
    @Transactional(timeout = 10)
    public Map<String, Object> reply(UUID userId, UUID sessionId, UUID questionId, String userAnswer) {
        InterviewSession session = sessionRepo.findById(sessionId)
            .filter(s -> s.getUserId().equals(userId))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Session not found"));

        if ("completed".equals(session.getStatus()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Session already completed");

        InterviewQuestionBank question = questionRepo.findById(questionId)
            .filter(q -> q.getUserId().equals(userId))
            .filter(q -> q.getUserJobId().equals(session.getUserJobId()))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Question not found or access denied"));

        String scorePrompt = String.format("""
            Rate this interview answer on a scale of 0 to 10.
            Question: %s
            Model answer: %s
            Candidate answer: %s

            Respond ONLY with:
            SCORE: [0-10]
            FEEDBACK: [one sentence of constructive feedback]
            """, question.getQuestion(), question.getModelAnswer(), userAnswer);

        long startMs = System.currentTimeMillis();
        String aiResp;
        try {
            aiResp = gemini.generate(scorePrompt, userId, "mock-interview");
            aiMetrics.recordSuccess("gemini", System.currentTimeMillis() - startMs);
        } catch (Exception e) {
            aiMetrics.recordFailure("gemini");
            aiResp = "SCORE: 5\nFEEDBACK: Could not score answer — please try again.";
        }

        BigDecimal score = parseScore(aiResp);
        String feedback = parseFeedback(aiResp);

        question.setUserAnswer(userAnswer);
        question.setScore(score);
        questionRepo.save(question);

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
            pushNotification(userId, session.getUserJobId(), "MOCK_INTERVIEW_COMPLETE",
                    "Mock interview complete!",
                    "You scored " + String.format("%.1f", avg) + "/10 overall.");
        }

        @Nullable InterviewQuestionBank next = allQs.stream()
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

    // ── Get session history ────────────────────────────────────────────────────
    public List<InterviewSession> historyForJob(UUID userJobId, UUID userId) {
        UserJob userJob = userJobRepo.findById(userJobId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "UserJob not found"));
        if (!userJob.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "UserJob not found");
        }
        return sessionRepo.findByUserJobIdOrderByStartedAtDesc(userJobId);
    }

    public List<InterviewSession> historyForUser(UUID userId) {
        return sessionRepo.findByUserIdOrderByStartedAtDesc(userId);
    }

    // ── Parse kit response ─────────────────────────────────────────────────────

    private List<InterviewQuestionBank> parseAndSaveQuestions(
            UUID userId, UUID userJobId, String aiResponse) {
        List<InterviewQuestionBank> saved = new java.util.ArrayList<>();
        try {
            String clean = aiResponse
                    .replaceAll("```[^\\n]*\\n?", "")
                    .replaceAll("```", "")
                    .trim();
            // Split on }, { boundaries
            String[] blocks = clean.split("\\},\\s*\\{");
            for (String block : blocks) {
                String question   = extractField(block, "question", null);
                String modelAns   = extractField(block, "modelAnswer", null);
                String skillArea  = extractField(block, "skillArea", "GENERAL");
                if (question == null || question.isBlank()) continue;

                InterviewQuestionBank q = InterviewQuestionBank.builder()
                        .id(UUID.randomUUID())
                        .userId(userId)
                        .userJobId(userJobId)
                        .question(question)
                        .modelAnswer(modelAns != null ? modelAns : "")
                        .skillArea(skillArea)
                        .build();
                saved.add(questionRepo.save(q));
            }
        } catch (Exception e) {
            log.warn("[MockInterview] Could not parse kit questions: {}", e.getMessage());
        }
        return saved;
    }

    // ── Parse Gemini score response ────────────────────────────────────────────
    private BigDecimal parseScore(@Nullable String resp) {
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

    private String parseFeedback(@Nullable String resp) {
        if (resp == null) return "";
        for (String line : resp.split("\n")) {
            if (line.trim().startsWith("FEEDBACK:")) {
                return line.replace("FEEDBACK:", "").trim();
            }
        }
        return "";
    }

    private @Nullable String extractField(String block, String key, @Nullable String fallback) {
        try {
            String marker = "\"" + key + "\":\"";
            int start = block.indexOf(marker);
            if (start < 0) return fallback;
            int valueStart = start + marker.length();
            int valueEnd = block.indexOf("\"", valueStart);
            return valueEnd > valueStart ? block.substring(valueStart, valueEnd) : fallback;
        } catch (Exception e) { return fallback; }
    }

    // ── Notification helper (Batch 3) ──────────────────────────────────────────

    private void pushNotification(UUID userId, UUID userJobId, String type, String title, String body) {
        try {
            Notification n = new Notification();
            n.setId(UUID.randomUUID());
            n.setUserId(userId);
            n.setType(type);
            n.setTitle(title);
            n.setBody(body);
            n.setRead(false);
            n.setCreatedAt(Instant.now());
            n.setEntityType("user_job");
            n.setEntityId(userJobId);
            notificationRepo.save(n);
        } catch (Exception e) {
            log.warn("[MockInterview] Could not push notification type={}: {}", type, e.getMessage());
        }
    }

    // ---- Mappers for 2.056 ----

    public com.careerops.dto.InterviewDTO.SessionResponse toSessionResponse(InterviewSession s) {
        return com.careerops.dto.InterviewDTO.SessionResponse.builder()
                .id(s.getId())
                .trackId(s.getTrackId())
                .userJobId(s.getUserJobId())
                .mode(s.getMode())
                .status(s.getStatus())
                .overallScore(s.getOverallScore())
                .strengths(s.getStrengths())
                .weaknesses(s.getWeaknesses())
                .startedAt(s.getStartedAt())
                .completedAt(s.getCompletedAt())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
