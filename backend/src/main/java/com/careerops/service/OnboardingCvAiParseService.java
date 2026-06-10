package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Slim AI extraction for onboarding CV parse (step 1).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OnboardingCvAiParseService {

    private static final String FEATURE = "onboarding-cv-parse";
    private static final int MAX_CV_CHARS = 14_000;

    private static final String SYSTEM_PROMPT = """
        You extract structured data from a CV/résumé for onboarding form prefill.
        Return a single JSON object only — no markdown fences, no commentary outside JSON.
        Do not invent employers, schools, or dates not present in the CV.
        Use Irish/UK English. Keep cvMarkdown concise (short ## sections); prioritize structured arrays over long prose.

        JSON schema:
        {
          "headline": "string, max 120 chars, professional title line",
          "linkedInUrl": "https URL or empty string",
          "githubUrl": "https URL or empty string",
          "websiteUrl": "https URL or empty string",
          "techStack": ["canonical skill names, max 40 items"],
          "targetRoles": ["job search titles the candidate should pursue, max 8 items"],
          "workExperience": [{
            "jobTitle": "string",
            "companyName": "string",
            "startDate": "YYYY-MM or YYYY",
            "endDate": "YYYY-MM or YYYY or empty if current",
            "current": boolean,
            "description": "bullet text, newlines between bullets",
            "location": "string"
          }],
          "education": [{
            "schoolName": "string",
            "degree": "string",
            "fieldOfStudy": "string",
            "startYear": "YYYY",
            "endYear": "YYYY",
            "graduationYear": "YYYY",
            "location": "string"
          }],
          "projects": [{
            "title": "string",
            "description": "string",
            "url": "primary project URL (https preferred): GitHub/GitLab/Bitbucket repo if present, else live demo",
            "location": "string",
            "techTags": ["string"]
          }],
          "cvMarkdown": "markdown with ## Summary, ## Experience, ## Skills, ## Education sections"
        }

        For targetRoles: infer forward-looking searchable job titles from experience, skills, seniority, and trajectory.
        Prefer Irish/UK job-board titles. Do not invent seniority the CV does not support.
        Align with this catalog when possible: %s.

        For each project url: extract the primary link from anywhere in the project text (title, bullets, description).
        If the title shows "| Link" or similar placeholder, find the real URL in the description. Prefer repo URLs over live demos.
        Use full https URLs. Do not duplicate the URL inside description when url is set.
        """.formatted(OnboardingRoleCatalog.promptCatalogHint());

    private final NvidiaService nvidia;
    private final OnboardingCvParseResultValidator validator;

    public Optional<OnboardingCvParseResultValidator.ValidatedAiParse> parse(String cvText) {
        if (cvText == null || cvText.isBlank()) {
            return Optional.empty();
        }
        if (!nvidia.isConfigured()) {
            return Optional.empty();
        }
        try {
            String userPrompt = "CV TEXT:\n" + truncate(cvText, MAX_CV_CHARS);
            JsonNode root = nvidia.generateJsonWithoutUserConsent(SYSTEM_PROMPT, userPrompt, FEATURE);
            OnboardingCvParseResultValidator.ValidatedAiParse validated = validator.validate(root);
            return Optional.of(validated);
        } catch (Exception e) {
            log.warn("Onboarding AI CV parse failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static String truncate(String text, int max) {
        if (text.length() <= max) return text;
        return text.substring(0, max);
    }
}
