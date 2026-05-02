package com.careerops.service;

import com.careerops.model.InterviewQuestionBank;
import com.careerops.model.InterviewTrack;
import com.careerops.model.UserJob;
import com.careerops.repository.InterviewQuestionBankRepository;
import com.careerops.repository.InterviewTrackRepository;
import com.careerops.repository.UserJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Task 7 — InterviewCoachService
 * Generates company-specific and role-specific interview kits.
 * Uses the AI orchestration layer (GeminiService) to produce tailored question sets.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewCoachService {

    private final UserJobRepository userJobRepo;
    private final InterviewTrackRepository interviewTrackRepo;
    private final InterviewQuestionBankRepository questionBankRepo;
    private final GeminiService geminiService;

    /**
     * Generates a full interview kit for the given userJob.
     * Creates or updates an InterviewTrack and populates the question bank.
     */
    public InterviewTrack generateKit(UUID userJobId, UUID requestingUserId) {
        UserJob userJob = userJobRepo.findById(userJobId)
                .orElseThrow(() -> new IllegalArgumentException("UserJob not found: " + userJobId));

        if (!userJob.getUserId().equals(requestingUserId)) {
            throw new SecurityException("Access denied to userJob: " + userJobId);
        }

        // Find or create the track
        InterviewTrack track = interviewTrackRepo
                .findByUserJobId(userJobId)
                .orElseGet(() -> {
                    InterviewTrack t = new InterviewTrack();
                    t.setId(UUID.randomUUID());
                    t.setUserJobId(userJobId);
                    t.setUserId(requestingUserId);
                    t.setStage("PREP");
                    t.setCreatedAt(LocalDateTime.now());
                    return t;
                });
        track.setUpdatedAt(LocalDateTime.now());
        interviewTrackRepo.save(track);

        // Build prompt context
        String jobTitle   = userJob.getJobTitle() != null ? userJob.getJobTitle() : "Software Engineer";
        String company    = userJob.getCompanyName() != null ? userJob.getCompanyName() : "the company";
        String skillsJson = userJob.getSkillsJson() != null ? userJob.getSkillsJson() : "[]";

        String prompt = String.format(
            """You are an expert interview coach. Generate a comprehensive interview preparation kit for a %s role at %s.
            The candidate's relevant skills are: %s.
            Produce exactly 15 questions in these categories:
            - 5 Technical/Skills questions
            - 4 Behavioural (STAR format)
            - 3 Company/Culture fit
            - 3 Role-specific scenario questions
            For each question provide: category, question text, ideal answer outline (3 bullet points), difficulty (Easy/Medium/Hard).
            Return as a JSON array: [{\"category\":\"\",\"question\":\"\",\"answerOutline\":[],\"difficulty\":\"\"}]""",
            jobTitle, company, skillsJson
        );

        String aiResponse = geminiService.generateContent(prompt);

        // Parse and persist question bank entries
        // Simplified: store raw AI response as a single bank entry with full JSON
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
}
