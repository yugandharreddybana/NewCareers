package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * CV quality scoring service used by the tailor-resume skill.
 *
 * Primary path  — NvidiaService (NvidiaService.generateJson):
 *   Evaluates the CV against the job description, returning:
 *     - atsScore   (0-100): keyword coverage vs JD
 *     - humanScore (0-100): natural, human-sounding writing quality
 *     - flaggedPhrases: AI clichés to rewrite with specific suggestions
 *
 * Fallback path — regex heuristics:
 *   Used when NVIDIA NIM is unavailable or the API call fails.
 */
@Service
public class CvHumanScoreService {

    private static final Logger log = LoggerFactory.getLogger(CvHumanScoreService.class);

    private static final String SYSTEM_PROMPT = """
        You are an expert ATS (Applicant Tracking System) analyst and senior UK/Ireland hiring consultant.
        You will be given a tailored CV and a job description.
        Evaluate the CV and return ONLY a valid JSON object with exactly these three keys:

        {
          "atsScore": <integer 0-100>,
          "humanScore": <integer 0-100>,
          "flaggedPhrases": [
            { "phrase": "...", "context": "...", "suggestedRewrite": "..." }
          ]
        }

        Scoring rules:
        atsScore — What % of significant keywords from the JD appear in the CV.
          Count: technical skills, role titles, tools, domain terms, methodologies.
          Ignore: prepositions, articles, common filler words.

        humanScore — How natural and human does the CV read?
          90-100: Real professional voice, specific quantified achievements
          70-89:  Mostly good, minor AI patterns
          50-69:  Noticeable AI language, some generic phrases
          30-49:  Heavy AI clichés, vague unsupported claims
          0-29:   Almost entirely generic filler

        flaggedPhrases — identify these AI/cliché phrases if present:
          leveraged, spearheaded, synergies, passionate about, team player,
          results-driven, dynamic professional, go-getter, thought leader,
          proactive, self-starter, detail-oriented, strong communication skills,
          excellent interpersonal skills, hardworking, motivated individual,
          fast-paced environment, value-add, robust solution, holistic approach,
          cutting-edge, innovative solutions, best-in-class, paradigm shift,
          bandwidth, deep dive, move the needle, circle back, touch base,
          at the end of the day, hit the ground running, game-changer,
          demonstrated ability, unique opportunity.

        For each flagged phrase:
          - phrase: the exact phrase found in the CV
          - context: the surrounding clause (max 80 chars)
          - suggestedRewrite: a specific, actionable replacement using Irish/UK English

        Return ONLY the JSON object. No markdown, no commentary, no code fences.
        """;

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

    private final NvidiaService nvidia;
    private final ObjectMapper  mapper;

    public CvHumanScoreService(NvidiaService nvidia, ObjectMapper mapper) {
        this.nvidia = nvidia;
        this.mapper = mapper;
    }

    public CvScoreResult score(String cvText, String jobText, java.util.UUID userId) {
        if (cvText == null || cvText.isBlank()) {
            return new CvScoreResult(0, 0, List.of());
        }
        try {
            return scoreWithNvidia(cvText, jobText, userId);
        } catch (Exception e) {
            log.warn("CvHumanScoreService: NVIDIA scoring failed, using regex fallback. reason={}", e.getMessage());
            return scoreWithRegex(cvText, jobText);
        }
    }

    private CvScoreResult scoreWithNvidia(String cvText, String jobText, java.util.UUID userId) {
        String cvSnippet = cvText.length() > 6000  ? cvText.substring(0, 6000)  : cvText;
        String jdSnippet = (jobText == null || jobText.isBlank())
                           ? "No job description provided."
                           : (jobText.length() > 3000 ? jobText.substring(0, 3000) : jobText);

        String userPrompt = """
                CV TO EVALUATE:
                ---
                %s
                ---

                JOB DESCRIPTION:
                ---
                %s
                ---

                Evaluate the CV against the job description and return the JSON scores.
                """.formatted(cvSnippet, jdSnippet);

        JsonNode root       = nvidia.generateJson(SYSTEM_PROMPT, userPrompt, userId, "tailor-resume");
        int      atsScore   = clamp(root.path("atsScore").asInt(0));
        int      humanScore = clamp(root.path("humanScore").asInt(0));

        List<FlaggedPhrase> flaggedPhrases = new ArrayList<>();
        JsonNode phrases = root.path("flaggedPhrases");
        if (phrases.isArray()) {
            for (JsonNode fp : phrases) {
                String phrase  = fp.path("phrase").asText("");
                String context = fp.path("context").asText("");
                String rewrite = fp.path("suggestedRewrite").asText("Replace with a specific, quantified achievement");
                if (!phrase.isBlank()) flaggedPhrases.add(new FlaggedPhrase(phrase, context, rewrite));
            }
        }
        log.info("CvHumanScoreService (NVIDIA): atsScore={}, humanScore={}, flaggedCount={}", atsScore, humanScore, flaggedPhrases.size());
        return new CvScoreResult(atsScore, humanScore, flaggedPhrases);
    }

    private CvScoreResult scoreWithRegex(String cvText, String jobText) {
        int                 atsScore       = calculateAtsScore(cvText, jobText);
        List<FlaggedPhrase> flaggedPhrases = detectAiPhrases(cvText);
        int                 humanScore     = calculateHumanScore(cvText, flaggedPhrases.size());
        return new CvScoreResult(atsScore, humanScore, flaggedPhrases);
    }

    private int calculateAtsScore(String cvText, String jobText) {
        if (cvText == null || jobText == null || cvText.isBlank() || jobText.isBlank()) return 0;
        String cvLower  = cvText.toLowerCase();
        String jobLower = jobText.toLowerCase();
        String[] jobWords = jobLower.split("[\\s,;.()\\[\\]/\"]+");
        List<String> keywords = new ArrayList<>();
        for (String word : jobWords) {
            String cleaned = word.replaceAll("[^a-z0-9#.+]", "");
            if (cleaned.length() >= 4 && !isStopWord(cleaned)) keywords.add(cleaned);
        }
        if (keywords.isEmpty()) return 0;
        List<String> unique  = keywords.stream().distinct().toList();
        long         matched = unique.stream().filter(cvLower::contains).count();
        return (int) Math.round((double) matched / unique.size() * 100);
    }

    private int calculateHumanScore(String cvText, int flaggedCount) {
        if (cvText == null || cvText.isBlank()) return 0;
        int score = 100;
        score -= Math.min(flaggedCount * 5, 50);
        long quantified = Pattern.compile("(\\d+%|\u20ac\\d+|\\d+ percent|\\d+ users|\\d+ team)",
                Pattern.CASE_INSENSITIVE).matcher(cvText).results().count();
        score += (int) Math.min(quantified * 2, 15);
        long passiveCount = Pattern.compile(
                "\\b(was|were|been|being) (managed|led|handled|responsible)",
                Pattern.CASE_INSENSITIVE).matcher(cvText).results().count();
        score -= (int) Math.min(passiveCount * 3, 15);
        return Math.max(0, Math.min(100, score));
    }

    private List<FlaggedPhrase> detectAiPhrases(String cvText) {
        if (cvText == null || cvText.isBlank()) return List.of();
        String cvLower = cvText.toLowerCase();
        List<FlaggedPhrase> results = new ArrayList<>();
        for (String phrase : AI_PATTERN_PHRASES) {
            int idx = cvLower.indexOf(phrase);
            if (idx >= 0) {
                int    start   = Math.max(0, idx - 20);
                int    end     = Math.min(cvText.length(), idx + phrase.length() + 40);
                String context = cvText.substring(start, end).trim();
                results.add(new FlaggedPhrase(phrase, context, suggestRewrite(phrase)));
            }
        }
        return results;
    }

    private String suggestRewrite(String phrase) {
        return switch (phrase) {
            case "leveraged"            -> "Used / Applied / Utilised";
            case "spearheaded"          -> "Led / Drove / Initiated";
            case "synergies"            -> "Combined benefits / Shared capabilities";
            case "passionate about"     -> "Focused on / Committed to";
            case "team player"          -> "Collaborated with / Contributed to team";
            case "results-driven"       -> "Delivered [specific result]";
            case "dynamic professional" -> "[Specific role title with context]";
            case "thought leader"       -> "Subject matter expert in [domain]";
            case "proactive"            -> "Initiated [specific action]";
            case "self-starter"         -> "Independently [specific achievement]";
            default                     -> "Replace with a specific, quantified achievement";
        };
    }

    private boolean isStopWord(String word) {
        return Map.of("with", true, "that", true, "this", true, "from", true,
                      "your", true, "have", true, "will", true, "they", true).containsKey(word)
            || Map.of("what", true, "able", true, "been", true, "also", true).containsKey(word);
    }

    private int clamp(int value) { return Math.max(0, Math.min(100, value)); }

    public record FlaggedPhrase(String phrase, String context, String suggestedRewrite) {}
    public record CvScoreResult(int atsScore, int humanScore, List<FlaggedPhrase> flaggedPhrases) {}
}
