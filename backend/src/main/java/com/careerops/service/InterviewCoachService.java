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
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InterviewCoachService {

    private final InterviewTrackRepository interviewTrackRepository;
    private final InterviewQuestionBankRepository questionBankRepository;
    private final UserJobRepository userJobRepository;
    private final GeminiService geminiService;

    @Transactional
    public InterviewTrack getOrCreateTrack(UUID userJobId, UUID userId) {
        return interviewTrackRepository.findByUserJobId(userJobId)
                .orElseGet(() -> {
                    UserJob userJob = userJobRepository.findById(userJobId)
                            .orElseThrow(() -> new IllegalArgumentException("UserJob not found: " + userJobId));
                    InterviewTrack track = InterviewTrack.builder()
                            .userJobId(userJobId)
                            .userId(userId)
                            .currentStage("APPLIED")
                            .build();
                    return interviewTrackRepository.save(track);
                });
    }

    @Transactional
    public List<InterviewQuestionBank> generateInterviewKit(UUID userJobId, UUID userId) {
        InterviewTrack track = getOrCreateTrack(userJobId, userId);

        UserJob userJob = userJobRepository.findById(userJobId)
                .orElseThrow(() -> new IllegalArgumentException("UserJob not found: " + userJobId));

        String prompt = buildKitPrompt(track, userJob);
        String aiResponse = geminiService.generate(prompt);

        List<InterviewQuestionBank> questions = parseQuestionsFromAiResponse(aiResponse, track);
        return questionBankRepository.saveAll(questions);
    }

    public List<InterviewQuestionBank> getKitByTrack(UUID interviewTrackId) {
        return questionBankRepository.findByInterviewTrackId(interviewTrackId);
    }

    public List<InterviewTrack> getTracksByUser(UUID userId) {
        return interviewTrackRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public InterviewTrack updateStage(UUID trackId, String newStage) {
        InterviewTrack track = interviewTrackRepository.findById(trackId)
                .orElseThrow(() -> new IllegalArgumentException("Track not found: " + trackId));
        track.setCurrentStage(newStage);
        return interviewTrackRepository.save(track);
    }

    private String buildKitPrompt(InterviewTrack track, UserJob userJob) {
        return String.format("""
                Generate a structured interview preparation kit for the following role.
                Company: %s
                Role: %s
                Current Stage: %s

                Return exactly 10 interview questions in this JSON array format:
                [
                  {
                    "question": "<question text>",
                    "expectedAnswer": "<ideal answer guidance>",
                    "skillArea": "<e.g. Technical, Behavioural, Situational>",
                    "questionType": "<BEHAVIORAL|TECHNICAL|SITUATIONAL>"
                  }
                ]

                Mix question types: 4 behavioural, 3 technical, 3 situational.
                Make questions specific to the role and Irish job market context.
                Return only the JSON array, no other text.
                """,
                track.getCompanyName() != null ? track.getCompanyName() : "the company",
                track.getRoleTitle() != null ? track.getRoleTitle() : "the role",
                track.getCurrentStage()
        );
    }

    private List<InterviewQuestionBank> parseQuestionsFromAiResponse(String aiResponse, InterviewTrack track) {
        List<InterviewQuestionBank> questions = new ArrayList<>();
        try {
            String cleaned = aiResponse.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("```json", "").replaceAll("```", "").trim();
            }
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            List<Map<String, String>> parsed = mapper.readValue(cleaned,
                    mapper.getTypeFactory().constructCollectionType(List.class, Map.class));

            for (Map<String, String> item : parsed) {
                InterviewQuestionBank q = InterviewQuestionBank.builder()
                        .interviewTrackId(track.getId())
                        .companyName(track.getCompanyName())
                        .roleTitle(track.getRoleTitle())
                        .question(item.getOrDefault("question", ""))
                        .expectedAnswer(item.getOrDefault("expectedAnswer", ""))
                        .skillArea(item.getOrDefault("skillArea", "General"))
                        .questionType(item.getOrDefault("questionType", "BEHAVIORAL"))
                        .build();
                questions.add(q);
            }
        } catch (Exception e) {
            log.error("Failed to parse interview kit AI response", e);
        }
        return questions;
    }
}
