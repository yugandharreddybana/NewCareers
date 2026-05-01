package com.careerops.service;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.InterviewTrack;
import com.careerops.repository.InterviewQuestionBankRepository;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.InterviewTrackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MockInterviewService {

    private final InterviewSessionRepository sessionRepository;
    private final InterviewQuestionBankRepository questionBankRepository;
    private final InterviewTrackRepository interviewTrackRepository;
    private final GeminiService geminiService;

    @Transactional
    public InterviewSession startSession(UUID userJobId, UUID userId) {
        InterviewTrack track = interviewTrackRepository.findByUserJobId(userJobId)
                .orElseThrow(() -> new IllegalArgumentException("No interview track found for userJobId: " + userJobId));

        InterviewSession session = InterviewSession.builder()
                .interviewTrackId(track.getId())
                .userId(userId)
                .mode("TEXT")
                .build();
        return sessionRepository.save(session);
    }

    @Transactional
    public Map<String, Object> processReply(UUID sessionId, UUID questionId, String userAnswer) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        InterviewQuestionBank question = questionBankRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + questionId));

        String prompt = buildScoringPrompt(question.getQuestion(), question.getExpectedAnswer(), userAnswer);
        String aiResponse = geminiService.generate(prompt);

        Map<String, Object> scoreResult = parseScoringResponse(aiResponse);

        question.setUserAnswer(userAnswer);
        question.setAiFeedback((String) scoreResult.get("feedback"));
        Object rawScore = scoreResult.get("score");
        if (rawScore instanceof Integer) {
            question.setScore((Integer) rawScore);
        } else if (rawScore instanceof String) {
            try { question.setScore(Integer.parseInt((String) rawScore)); } catch (NumberFormatException ignored) {}
        }
        questionBankRepository.save(question);

        return scoreResult;
    }

    @Transactional
    public InterviewSession completeSession(UUID sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

        List<InterviewQuestionBank> answered = questionBankRepository
                .findBySessionId(sessionId)
                .stream()
                .filter(q -> q.getScore() != null)
                .toList();

        if (!answered.isEmpty()) {
            int avg = (int) answered.stream().mapToInt(InterviewQuestionBank::getScore).average().orElse(0);
            session.setOverallScore(avg);
            session.setFeedbackSummary(buildSessionSummary(answered));
        }

        session.setCompletedAt(Instant.now());
        return sessionRepository.save(session);
    }

    public List<InterviewSession> getSessionHistory(UUID userJobId) {
        InterviewTrack track = interviewTrackRepository.findByUserJobId(userJobId)
                .orElseThrow(() -> new IllegalArgumentException("No track found for userJobId: " + userJobId));
        return sessionRepository.findByInterviewTrackIdOrderByStartedAtDesc(track.getId());
    }

    private String buildScoringPrompt(String question, String expectedAnswer, String userAnswer) {
        return String.format("""
                You are an expert interview coach. Score the following interview answer.

                Question: %s
                Expected Answer Guidance: %s
                Candidate Answer: %s

                Respond in this exact JSON format:
                {
                  "score": <integer 0-100>,
                  "feedback": "<2-3 sentences of constructive feedback>",
                  "strengths": "<what they did well>",
                  "improvements": "<what to improve>"
                }

                Return only the JSON object, no other text.
                """, question, expectedAnswer != null ? expectedAnswer : "N/A", userAnswer);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseScoringResponse(String aiResponse) {
        try {
            String cleaned = aiResponse.trim()
                    .replaceAll("```json", "").replaceAll("```", "").trim();
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(cleaned, Map.class);
        } catch (Exception e) {
            log.error("Failed to parse scoring AI response", e);
            return Map.of("score", 0, "feedback", "Unable to score answer at this time.");
        }
    }

    private String buildSessionSummary(List<InterviewQuestionBank> answered) {
        long strongCount = answered.stream().filter(q -> q.getScore() != null && q.getScore() >= 70).count();
        long weakCount = answered.stream().filter(q -> q.getScore() != null && q.getScore() < 50).count();
        return String.format("Completed %d questions. %d strong answers (70+), %d areas needing improvement (<50).",
                answered.size(), strongCount, weakCount);
    }
}
