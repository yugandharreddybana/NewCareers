package com.careerops.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Secondary Gemini validation pass for AI-generated/tailored CVs.
 * Scores the generated CV on:
 *   1. ATS keyword match % against job description
 *   2. Human-readability naturalness score (0-100)
 *   3. Detects AI-pattern sentences and flags for rewrite
 */
@Service
public class CvHumanScoreService {

    private static final Logger log = LoggerFactory.getLogger(CvHumanScoreService.class);

    private static final List<String> AI_PATTERN_PHRASES = List.of(
        "leveraged", "spearheaded", "synergies", "passionate about",
        "team player", "results-driven", "dynamic professional", "go-getter",
        "thought leader", "proactive", "self-starter", "detail-oriented",
        "strong communication skills", "excellent interpersonal", "hardworking",
        "motivated individual", "fast-paced environment", "value-add",
        "robust solution", "holistic approach", "cutting-edge", "innovative solutions",
        "best-in-class", "paradigm shift", "bandwidth", "deep dive",
        "move the needle", "circle back", "touch base", "at the end of the day"
    );

    private final GeminiService geminiService;

    public CvHumanScoreService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    /**
     * Scores a CV against a job description.
     *
     * @param cvText    The generated/tailored CV text
     * @param jobText   The full job description text
     * @return CvScoreResult with ATS score, human score, flagged phrases
     */
    public CvScoreResult score(String cvText, String jobText) {
        int atsScore = calculateAtsScore(cvText, jobText);
        List<FlaggedPhrase> flaggedPhrases = detectAiPhrases(cvText);
        int humanScore = calculateHumanScore(cvText, flaggedPhrases.size());

        log.debug("CvHumanScore: atsScore={}, humanScore={}, flaggedCount={}",
                atsScore, humanScore, flaggedPhrases.size());

        return new CvScoreResult(atsScore, humanScore, flaggedPhrases);
    }

    /**
     * ATS keyword match: extracts significant terms from JD, checks presence in CV.
     * Returns 0-100.
     */
    private int calculateAtsScore(String cvText, String jobText) {
        if (cvText == null || jobText == null || cvText.isBlank() || jobText.isBlank()) return 0;

        String cvLower  = cvText.toLowerCase();
        String jobLower = jobText.toLowerCase();

        // Extract meaningful tokens (4+ chars, not stop words)
        String[] jobWords = jobLower.split("[\\s,;.()\\[\\]/\"]+");
        List<String> keywords = new ArrayList<>();
        for (String word : jobWords) {
            String cleaned = word.replaceAll("[^a-z0-9#.+]", "");
            if (cleaned.length() >= 4 && !isStopWord(cleaned)) {
                keywords.add(cleaned);
            }
        }

        if (keywords.isEmpty()) return 0;

        // Deduplicate
        List<String> unique = keywords.stream().distinct().toList();
        long matched = unique.stream().filter(cvLower::contains).count();
        return (int) Math.round((double) matched / unique.size() * 100);
    }

    /**
     * Human readability naturalness score.
     * Starts at 100, deducts for AI phrases and other signals.
     */
    private int calculateHumanScore(String cvText, int flaggedCount) {
        if (cvText == null || cvText.isBlank()) return 0;

        int score = 100;

        // Deduct per flagged AI phrase (up to -50)
        score -= Math.min(flaggedCount * 5, 50);

        // Bonus for quantified achievements (contains % or € or numbers)
        long quantified = Pattern.compile("(\\d+%|€\\d+|\\d+ percent|\\d+ users|\\d+ team)",
                Pattern.CASE_INSENSITIVE)
                .matcher(cvText).results().count();
        score += (int) Math.min(quantified * 2, 15);

        // Deduct for passive voice signals
        long passiveCount = Pattern.compile("\\b(was|were|been|being) (managed|led|handled|responsible)",
                Pattern.CASE_INSENSITIVE)
                .matcher(cvText).results().count();
        score -= (int) Math.min(passiveCount * 3, 15);

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Detects AI-pattern phrases in the CV text.
     */
    private List<FlaggedPhrase> detectAiPhrases(String cvText) {
        if (cvText == null || cvText.isBlank()) return List.of();
        String cvLower = cvText.toLowerCase();
        List<FlaggedPhrase> results = new ArrayList<>();

        for (String phrase : AI_PATTERN_PHRASES) {
            int idx = cvLower.indexOf(phrase);
            if (idx >= 0) {
                // Extract surrounding context (up to 60 chars)
                int start = Math.max(0, idx - 20);
                int end   = Math.min(cvText.length(), idx + phrase.length() + 40);
                String context  = cvText.substring(start, end).trim();
                String rewrite  = suggestRewrite(phrase);
                results.add(new FlaggedPhrase(phrase, context, rewrite));
            }
        }
        return results;
    }

    private String suggestRewrite(String phrase) {
        return switch (phrase) {
            case "leveraged"         -> "Used / Applied / Utilised";
            case "spearheaded"       -> "Led / Drove / Initiated";
            case "synergies"         -> "Combined benefits / Shared capabilities";
            case "passionate about"  -> "Focused on / Committed to";
            case "team player"       -> "Collaborated with / Contributed to team";
            case "results-driven"    -> "Delivered [specific result]";
            case "dynamic professional" -> "[specific role title with context]";
            case "thought leader"    -> "Subject matter expert in [domain]";
            case "proactive"         -> "Initiated [specific action]";
            case "self-starter"      -> "Independently [specific achievement]";
            default                  -> "Replace with a specific, quantified achievement";
        };
    }

    private boolean isStopWord(String word) {
        return Map.of(
            "with", true, "that", true, "this", true, "from", true,
            "your", true, "have", true, "will", true, "they", true,
            "what", true, "able", true, "been", true, "also", true
        ).containsKey(word);
    }

    // ── Value objects ─────────────────────────────────────────────────────────

    public record FlaggedPhrase(String phrase, String context, String suggestedRewrite) {}

    public record CvScoreResult(
        int atsScore,
        int humanScore,
        List<FlaggedPhrase> flaggedPhrases
    ) {}
}
