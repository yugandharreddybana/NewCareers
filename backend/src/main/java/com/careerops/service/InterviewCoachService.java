package com.careerops.service;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.InterviewTrack;
import com.careerops.model.Job;
import com.careerops.model.UserJob;
import com.careerops.repository.InterviewQuestionBankRepository;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.InterviewTrackRepository;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Section 3.1 — InterviewCoachService
 * Generates company/role-specific interview kits, evaluates candidate answers,
 * scores full mock sessions, and synthesises Gemini-powered feedback reports.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewCoachService {

    private final UserJobRepository userJobRepo;
    private final JobRepository jobRepo;
    private final InterviewTrackRepository interviewTrackRepo;
    private final InterviewQuestionBankRepository questionBankRepo;
    private final InterviewSessionRepository sessionRepo;
    private final GeminiService geminiService;

    // ─────────────────────────────────────────────────────────────────────────
    // 1.  KIT GENERATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generates a full interview kit for the given userJob.
     * Creates or updates an InterviewTrack and populates the question bank.
     */
    @Transactional
    public InterviewTrack generateKit(UUID userJobId, UUID requestingUserId) {
        UserJob userJob = userJobRepo.findById(userJobId)
                .orElseThrow(() -> new IllegalArgumentException("UserJob not found: " + userJobId));

        if (!userJob.getUserId().equals(requestingUserId)) {
            throw new SecurityException("Access denied to userJob: " + userJobId);
        }

        // Resolve underlying Job for title, company, and description (used for skill extraction)
        Job job = jobRepo.findById(userJob.getJobId())
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + userJob.getJobId()));

        String jobTitle = nvl(job.getTitle(),   "Software Engineer");
        String company  = nvl(job.getCompany(), "the company");
        // Use job description as a proxy for skills context
        String skillsContext = nvl(job.getDescription(), "general software engineering skills");
        // Trim to avoid excessively large prompts
        if (skillsContext.length() > 800) skillsContext = skillsContext.substring(0, 800) + "...";

        InterviewTrack track = interviewTrackRepo
                .findByUserJobId(userJobId)
                .orElseGet(() -> {
                    InterviewTrack t = new InterviewTrack();
                    t.setId(UUID.randomUUID());
                    t.setUserJobId(userJobId);
                    t.setUserId(requestingUserId);
                    t.setCurrentStage("PREP");
                    t.setCompanyName(company);
                    t.setRoleTitle(jobTitle);
                    t.setCreatedAt(Instant.now());
                    t.setUpdatedAt(Instant.now());
                    return t;
                });
        track.setUpdatedAt(Instant.now());
        interviewTrackRepo.save(track);

        String prompt = """
                You are an expert interview coach. Generate a comprehensive interview preparation kit
                for a %s role at %s. Context from the job description: %s.
                Produce exactly 15 questions across these categories:
                  - 5 Technical/Skills questions
                  - 4 Behavioural (STAR format)
                  - 3 Company/Culture fit
                  - 3 Role-specific scenario questions
                For each question provide: category, question text, idealAnswer (3 bullet points),
                difficulty (Easy/Medium/Hard).
                Return ONLY a JSON array:
                [{"category":"","question":"","idealAnswer":[],"difficulty":""}]
                """.formatted(jobTitle, company, skillsContext);

        String aiResponse = geminiService.generateContent(prompt);

        InterviewQuestionBank bank = new InterviewQuestionBank();
        bank.setId(UUID.randomUUID());
        bank.setTrackId(track.getId());
        bank.setUserJobId(userJobId);
        bank.setQuestionsJson(aiResponse);
        bank.setCompany(company);
        bank.setRoleTitle(jobTitle);
        bank.setGeneratedAt(LocalDateTime.now());
        questionBankRepo.save(bank);

        log.info("Interview kit generated for userJobId={} trackId={}", userJobId, track.getId());
        return track;
    }

    public List<InterviewQuestionBank> getQuestionsForJob(UUID userJobId) {
        return questionBankRepo.findByUserJobId(userJobId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2.  ANSWER EVALUATION  (per-question, real-time)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Evaluates a candidate's answer to a single interview question.
     * Returns a structured feedback string containing:
     *   - Score 1-10
     *   - What was strong
     *   - What was missing
     *   - A suggested improvement tip
     *
     * @param question     The interview question text
     * @param idealAnswer  Comma-joined ideal answer bullet points (from question bank)
     * @param candidateAnswer The candidate's typed answer
     * @return JSON string: {"score":7,"strong":"...","missing":"...","tip":"..."}
     */
    public String evaluateAnswer(String question, String idealAnswer, String candidateAnswer) {
        if (candidateAnswer == null || candidateAnswer.isBlank()) {
            return "{\"score\":0,\"strong\":\"\",\"missing\":\"No answer provided.\",\"tip\":\"Please attempt the question before submitting.\"}";
        }

        String prompt = """
                You are a senior interview coach evaluating a candidate's answer.

                QUESTION: %s

                IDEAL ANSWER POINTS:
                %s

                CANDIDATE'S ANSWER:
                %s

                Evaluate the candidate's answer strictly and fairly.
                Return ONLY valid JSON with this exact shape:
                {
                  "score": <integer 1-10>,
                  "strong": "<1-2 sentences on what the candidate did well>",
                  "missing": "<1-2 sentences on what was missing or weak>",
                  "tip": "<1 actionable improvement tip>"
                }
                Do not include any text outside the JSON object.
                """.formatted(question, idealAnswer, candidateAnswer);

        String raw = geminiService.generateContent(prompt);
        log.debug("Answer evaluation raw response: {}", raw);
        return extractJson(raw);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3.  SESSION SCORING  (end-of-session aggregate)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Computes an aggregate session score from a list of per-answer scores.
     * Weights: Technical (1.4×), Behavioural (1.0×), Culture (0.8×), Scenario (1.2×).
     *
     * @param answersJson JSON array of answered questions:
     *   [{"category":"Technical","score":7,...}, ...]
     * @return percentage score 0-100
     */
    public int scoreSession(String answersJson) {
        String prompt = """
                You are a scoring engine. Given the following JSON array of answered interview questions
                with per-question scores (1-10) and categories, compute a weighted aggregate session
                score as a percentage (0-100) using these category weights:
                  Technical: 1.4, Behavioural: 1.0, Company/Culture: 0.8, Scenario: 1.2

                ANSWERS: %s

                Return ONLY a JSON object:
                {"sessionScore": <integer 0-100>, "breakdown": {"Technical":<avg>,"Behavioural":<avg>,"Culture":<avg>,"Scenario":<avg>}}
                """.formatted(answersJson);

        String raw = geminiService.generateContent(prompt);
        String json = extractJson(raw);
        try {
            // Simple extraction to avoid adding Jackson dependency just for this
            int idx = json.indexOf("\"sessionScore\"");
            if (idx >= 0) {
                String sub = json.substring(idx + 15).stripLeading();
                if (sub.startsWith(":")) {
                    sub = sub.substring(1).stripLeading();
                    int end = sub.indexOf(',');
                    if (end < 0) end = sub.indexOf('}');
                    if (end > 0) return Math.min(100, Math.max(0, Integer.parseInt(sub.substring(0, end).trim())));
                }
            }
        } catch (NumberFormatException ignored) {}
        return 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4.  FEEDBACK SYNTHESIS  (post-session narrative report)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generates a full post-session feedback report from the complete session data.
     * Covers: overall performance, strengths, development areas, top 3 improvement actions.
     *
     * @param roleTitle     Job title the session was for
     * @param company       Company name
     * @param sessionScore  Aggregate session score (0-100)
     * @param answersJson   JSON array of answered questions with evaluations
     * @return Markdown-formatted feedback report string
     */
    public String synthesiseFeedback(String roleTitle, String company,
                                      int sessionScore, String answersJson) {
        String prompt = """
                You are a professional interview coach writing a post-session feedback report.

                ROLE: %s at %s
                SESSION SCORE: %d/100
                SESSION DATA (questions, candidate answers, per-question evaluations):
                %s

                Write a concise, constructive feedback report in Markdown format with these sections:
                ## Overall Performance
                (2-3 sentences summarising the session score and general performance)

                ## Strengths
                (3 bullet points — specific things the candidate did well)

                ## Areas for Development
                (3 bullet points — specific gaps identified)

                ## Top 3 Action Items
                (Numbered list — concrete, actionable steps the candidate should take before the next interview)

                Be specific, encouraging, and professional. Do not be generic.
                """.formatted(roleTitle, company, sessionScore, answersJson);

        return geminiService.generateContent(prompt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5.  SESSION PERSISTENCE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Persists a completed mock interview session.
     */
    @Transactional
    public InterviewSession saveSession(UUID trackId, UUID userJobId, UUID userId,
                                         int score, String feedbackMarkdown,
                                         String answersJson) {
        InterviewSession session = new InterviewSession();
        session.setId(UUID.randomUUID());
        session.setTrackId(trackId);
        session.setUserJobId(userJobId);
        session.setUserId(userId);
        session.setScore(score);
        session.setFeedback(feedbackMarkdown);
        session.setAnswersJson(answersJson);
        session.setCompletedAt(LocalDateTime.now());
        sessionRepo.save(session);
        log.info("Session saved: {} score={} for user={}", session.getId(), score, userId);
        return session;
    }

    public List<InterviewSession> getSessionsForTrack(UUID trackId) {
        return sessionRepo.findByTrackIdOrderByCompletedAtDesc(trackId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static String nvl(String value, String fallback) {
        return (value != null && !value.isBlank()) ? value : fallback;
    }

    /** Strips markdown fences if Gemini wraps the JSON in ```json ... ``` */
    private static String extractJson(String raw) {
        if (raw == null) return "{}";
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n');
            int end   = trimmed.lastIndexOf("```");
            if (start >= 0 && end > start) return trimmed.substring(start + 1, end).strip();
        }
        return trimmed;
    }
}
