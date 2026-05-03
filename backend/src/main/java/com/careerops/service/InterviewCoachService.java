package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewSession;
import com.careerops.model.InterviewTrack;
import com.careerops.repository.InterviewQuestionBankRepository;
import com.careerops.repository.InterviewSessionRepository;
import com.careerops.repository.InterviewTrackRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phase 3.1 — Interview Coach Service
 *
 * Generates company-specific and role-specific interview kits using Gemini AI.
 * Each kit is a set of questions with model answers stored in interview_question_bank.
 */
@Service
public class InterviewCoachService {

    private final InterviewTrackRepository trackRepo;
    private final InterviewSessionRepository sessionRepo;
    private final InterviewQuestionBankRepository questionRepo;
    private final GeminiService gemini;

    public InterviewCoachService(InterviewTrackRepository trackRepo,
                                  InterviewSessionRepository sessionRepo,
                                  InterviewQuestionBankRepository questionRepo,
                                  GeminiService gemini) {
        this.trackRepo = trackRepo;
        this.sessionRepo = sessionRepo;
        this.questionRepo = questionRepo;
        this.gemini = gemini;
    }

    // ── Generate interview kit for a job ──────────────────────────────────────
    @Transactional
    public List<InterviewQuestionBank> generateKit(UUID userId, UUID userJobId,
                                                    String companyName, String roleTitle,
                                                    String jobDescription) {
        // Ensure track exists
        InterviewTrack track = trackRepo.findByUserJobIdAndUserId(userJobId, userId)
            .orElseGet(() -> trackRepo.save(
                InterviewTrack.builder()
                    .userId(userId)
                    .userJobId(userJobId)
                    .companyName(companyName)
                    .roleTitle(roleTitle)
                    .currentStage("kit_generated")
                    .build()
            ));

        // Build Gemini prompt
        String prompt = buildKitPrompt(companyName, roleTitle, jobDescription);
        String aiResponse = gemini.generate(prompt);

        // Parse AI response into questions
        List<InterviewQuestionBank> questions = parseKitResponse(
            aiResponse, userId, userJobId, companyName, roleTitle, null
        );
        return questionRepo.saveAll(questions);
    }

    // ── Get history for a job ─────────────────────────────────────────────────
    public List<InterviewQuestionBank> getKitForJob(UUID userJobId) {
        return questionRepo.findByUserJobIdOrderByCreatedAtDesc(userJobId);
    }

    // ── Update track stage ────────────────────────────────────────────────────
    @Transactional
    public InterviewTrack updateStage(UUID userId, UUID userJobId, String stage) {
        InterviewTrack track = trackRepo.findByUserJobIdAndUserId(userJobId, userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Interview track not found"));
        track.setCurrentStage(stage);
        return trackRepo.save(track);
    }

    // ── List all tracks for user ──────────────────────────────────────────────
    public List<InterviewTrack> listTracks(UUID userId) {
        return trackRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private String buildKitPrompt(String company, String role, String jd) {
        return String.format("""
            You are an expert interview coach specialising in the Irish job market.
            Generate a complete interview preparation kit for a candidate applying to %s for the role of %s.

            Job description context:
            %s

            Return exactly 10 interview questions as a numbered list in this format:
            Q: [question text]
            A: [model answer — 3 to 5 sentences, specific and achievement-focused]
            SKILL: [one of: behavioural, technical, situational, motivational, culture]

            Cover: 3 behavioural, 3 technical, 2 situational, 1 motivational, 1 culture-fit question.
            Make answers ATS-friendly and Irish-market relevant.
            """,
            company != null ? company : "the company",
            role != null ? role : "the role",
            jd != null ? jd.substring(0, Math.min(jd.length(), 1500)) : "Not provided"
        );
    }

    private List<InterviewQuestionBank> parseKitResponse(String response, UUID userId,
                                                          UUID userJobId, String company,
                                                          String role, UUID sessionId) {
        List<InterviewQuestionBank> list = new ArrayList<>();
        if (response == null || response.isBlank()) return list;

        String[] lines = response.split("\n");
        String currentQ = null, currentA = null, currentSkill = "general";
        int turn = 0;

        for (String raw : lines) {
            String line = raw.trim();
            if (line.startsWith("Q:")) {
                currentQ = line.substring(2).trim();
            } else if (line.startsWith("A:")) {
                currentA = line.substring(2).trim();
            } else if (line.startsWith("SKILL:")) {
                currentSkill = line.substring(6).trim().toLowerCase();
                if (currentQ != null && currentA != null) {
                    list.add(InterviewQuestionBank.builder()
                        .userId(userId)
                        .userJobId(userJobId)
                        .sessionId(sessionId)
                        .companyName(company)
                        .roleTitle(role)
                        .skillArea(currentSkill)
                        .question(currentQ)
                        .modelAnswer(currentA)
                        .turnNumber(turn++)
                        .build());
                    currentQ = null; currentA = null; currentSkill = "general";
                }
            }
        }
        return list;
    }
}
