package com.careerops.service;

import com.careerops.model.User;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Post-processes cover-letter skill output: real candidate name, paragraph breaks, word count.
 */
@Component
public class CoverLetterNormalizer {

    private final ObjectMapper mapper;
    private final UserRepository users;
    private final UserProfileRepository profiles;

    public CoverLetterNormalizer(
            ObjectMapper mapper,
            UserRepository users,
            UserProfileRepository profiles) {
        this.mapper = mapper;
        this.users = users;
        this.profiles = profiles;
    }

    public record CoverLetterContext(User user, String currentCompany) {}

    private static final Pattern CANDIDATE_NAME = Pattern.compile(
            "\\[\\s*(?:Your|Candidate)\\s+Name\\s*\\]|\\{\\{\\s*name\\s*\\}\\}",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern CURRENT_COMPANY = Pattern.compile(
            "\\[\\s*Current\\s+Company\\s*\\]",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SALUTATION = Pattern.compile("(?is)^(Dear[^,]+,)\\s*");
    private static final Pattern CLOSING_TAIL = Pattern.compile(
            "(?is)\\s*((?:Yours sincerely|Yours faithfully|Kind regards|Best regards|Regards|Sincerely),?)\\s*(.*)$");

    /** Normalize stored output for display/PDF (fixes legacy single-block runs). */
    public ObjectNode normalizeForUser(java.util.UUID userId, JsonNode raw) {
        User user = users.findById(userId).orElse(null);
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        return normalize(raw, contextFor(user, profile));
    }

    public CoverLetterContext contextFor(User user, UserProfile profile) {
        return new CoverLetterContext(user, resolveCurrentCompany(profile));
    }

    public ObjectNode normalize(JsonNode raw, CoverLetterContext context) {
        ObjectNode out = raw != null && raw.isObject()
                ? (ObjectNode) raw.deepCopy()
                : mapper.createObjectNode();

        String letter = out.path("letter").asText("");
        if (letter.isBlank()) {
            return out;
        }

        letter = applyPlaceholders(letter, context);
        letter = ensureParagraphBreaks(letter);
        letter = letter.replaceAll("\\n{3,}", "\n\n").trim();

        out.put("letter", letter);
        out.put("wordCount", countWords(letter));
        return out;
    }

    public ObjectNode normalize(JsonNode raw, User user) {
        return normalize(raw, new CoverLetterContext(user, null));
    }

    static String applyPlaceholders(String letter, CoverLetterContext context) {
        String name = resolveCandidateName(context != null ? context.user() : null);
        String company = context != null && context.currentCompany() != null
                ? context.currentCompany().trim()
                : "";

        String result = CANDIDATE_NAME.matcher(letter).replaceAll(Matcher.quoteReplacement(name));
        if (!company.isBlank()) {
            result = CURRENT_COMPANY.matcher(result).replaceAll(Matcher.quoteReplacement(company));
        } else {
            result = CURRENT_COMPANY.matcher(result).replaceAll("");
        }
        return result;
    }

    static String resolveCurrentCompany(UserProfile profile) {
        if (profile == null || profile.getWorkExperience() == null) {
            return "";
        }
        return profile.getWorkExperience().stream()
                .filter(w -> w != null && w.getCompanyName() != null && !w.getCompanyName().isBlank())
                .filter(w -> w.isCurrent())
                .map(UserProfile.WorkExperienceEntry::getCompanyName)
                .findFirst()
                .orElseGet(() -> profile.getWorkExperience().stream()
                        .filter(w -> w != null && w.getCompanyName() != null && !w.getCompanyName().isBlank())
                        .map(UserProfile.WorkExperienceEntry::getCompanyName)
                        .findFirst()
                        .orElse(""));
    }

    static String resolveCandidateName(User user) {
        if (user == null) {
            return "";
        }
        String name = user.getName();
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        String email = user.getEmail();
        if (email != null && email.contains("@")) {
            return email.substring(0, email.indexOf('@')).replace('.', ' ').trim();
        }
        return "";
    }

    static String ensureParagraphBreaks(String letter) {
        String text = letter.replace("\r\n", "\n").replaceAll("[ \\t]+", " ").trim();
        if (text.isBlank()) {
            return text;
        }

        String salutation = "";
        Matcher salutationMatcher = SALUTATION.matcher(text);
        if (salutationMatcher.find()) {
            salutation = salutationMatcher.group(1).trim();
            text = text.substring(salutationMatcher.end()).trim();
        }

        String closingLine = "";
        String signature = "";
        Matcher closingMatcher = CLOSING_TAIL.matcher(text);
        int closingStart = -1;
        while (closingMatcher.find()) {
            closingStart = closingMatcher.start();
            closingLine = closingMatcher.group(1).trim();
            signature = closingMatcher.group(2).trim();
        }
        String body = closingStart >= 0 ? text.substring(0, closingStart).trim() : text;

        List<String> paragraphs = splitBodyIntoParagraphs(body);

        StringBuilder result = new StringBuilder();
        if (!salutation.isBlank()) {
            result.append(salutation);
        }
        for (String paragraph : paragraphs) {
            if (paragraph.isBlank()) {
                continue;
            }
            if (result.length() > 0) {
                result.append("\n\n");
            }
            result.append(paragraph.trim());
        }
        if (!closingLine.isBlank()) {
            if (result.length() > 0) {
                result.append("\n\n");
            }
            String formattedClosing = closingLine.endsWith(",") ? closingLine : closingLine + ",";
            result.append(formattedClosing);
            if (!signature.isBlank()) {
                result.append("\n\n").append(signature.trim());
            }
        }
        return result.toString();
    }

    static List<String> splitBodyIntoParagraphs(String body) {
        if (body.isBlank()) {
            return List.of();
        }
        if (body.contains("\n\n")) {
            return List.of(body.split("\\n\\n+")).stream()
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
        }

        String[] sentences = body.split("(?<=[.!?])\\s+(?=[A-Z\"'(])");
        if (sentences.length <= 2) {
            return List.of(body.trim());
        }

        List<String> paragraphs = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int sentenceCount = 0;

        for (String sentence : sentences) {
            String trimmed = sentence.trim();
            if (trimmed.isBlank()) {
                continue;
            }
            if (current.length() > 0) {
                current.append(' ');
            }
            current.append(trimmed);
            sentenceCount++;

            boolean topicBreak = trimmed.matches(
                    "(?i)^(Furthermore|Moreover|In addition|Additionally|I am particularly|My experience|"
                            + "During my|With over|I believe|I would welcome|Please do not hesitate).*");

            if (sentenceCount >= 2 || topicBreak) {
                paragraphs.add(current.toString().trim());
                current = new StringBuilder();
                sentenceCount = 0;
            }
        }
        if (current.length() > 0) {
            paragraphs.add(current.toString().trim());
        }
        return paragraphs;
    }

    static int countWords(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return text.trim().split("\\s+").length;
    }
}
