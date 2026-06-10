package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.careerops.security.AesGcmCodec;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * Section resolution and professional-summary copy for the deterministic tailor fallback
 * (when NVIDIA AI is unavailable or output is rejected).
 */
final class TailorResumeDeterministicSupport {

    private static final String LEGACY_STACK_PHRASE = "where this stack is central to the posting";
    private static final String LEGACY_OUTCOMES_PHRASE =
        "Ready to deliver measurable outcomes aligned to the team's priorities";

    private TailorResumeDeterministicSupport() {}

    static boolean isLegacyTemplateSummary(String summary) {
        if (summary == null || summary.isBlank()) {
            return false;
        }
        return summary.contains(LEGACY_STACK_PHRASE) || summary.contains(LEGACY_OUTCOMES_PHRASE);
    }

    /**
     * True when stored tailor output will render as summary-only or uses the old tech template.
     */
    static boolean needsSectionRepair(com.fasterxml.jackson.databind.JsonNode out) {
        if (out == null || !out.isObject()) {
            return true;
        }
        if (isLegacyTemplateSummary(out.path("summary").asText(""))) {
            return true;
        }
        com.fasterxml.jackson.databind.JsonNode sections = out.path("sections");
        if (!sections.isArray() || sections.isEmpty()) {
            return true;
        }
        boolean hasExperience = false;
        int renderable = 0;
        for (com.fasterxml.jackson.databind.JsonNode row : sections) {
            String name = row.path("name").asText("").toLowerCase(Locale.ROOT);
            if (name.equals("header") || name.equals("contact")
                || name.equals("cv") || name.equals("resume")) {
                continue;
            }
            String rewritten = row.path("rewritten").asText("").trim();
            if (rewritten.isBlank()) {
                continue;
            }
            renderable++;
            if (name.contains("experience") && rewritten.length() > 40) {
                hasExperience = true;
            }
        }
        return renderable <= 1 || !hasExperience;
    }

    static List<CvMarkdownSections.Section> ensureTailorableSections(
            List<CvMarkdownSections.Section> parsed,
            UserProfile profile,
            String baseline) {
        if (hasTailorableContentSections(parsed)) {
            return parsed;
        }
        String normalized = CvNormalizationService.buildDeterministicMarkdown(baseline, profile, null);
        List<CvMarkdownSections.Section> reparsed = CvMarkdownSections.parse(normalized);
        if (hasTailorableContentSections(reparsed)) {
            return reparsed;
        }
        return synthesizeSectionsFromProfile(profile, baseline);
    }

    /**
     * True when at least one section besides Header/CV will render in the HTML preview.
     */
    static boolean hasTailorableContentSections(List<CvMarkdownSections.Section> parsed) {
        if (parsed == null || parsed.isEmpty()) {
            return false;
        }
        long contentSections = parsed.stream()
            .filter(s -> !isStructuralOnlySection(s.name()))
            .filter(s -> s.body() != null && !s.body().isBlank())
            .count();
        return contentSections >= 2;
    }

    static String buildThreeSentenceSummary(UserProfile profile, Job job, List<String> matched) {
        String role = job != null ? safe(job.getTitle()) : "this role";
        String company = job != null ? safe(job.getCompany()) : "the employer";
        boolean techRole = looksTechRole(job, profile);

        String sentence1 = whoYouAreSentence(profile, job, techRole);
        String sentence2 = skillsSentence(matched, profile, job, techRole);
        String sentence3 = valueSentence(role, company, techRole);

        return sentence1 + " " + sentence2 + " " + sentence3;
    }

    private static List<CvMarkdownSections.Section> synthesizeSectionsFromProfile(
            UserProfile profile,
            String baseline) {
        List<CvMarkdownSections.Section> sections = new ArrayList<>();

        String summaryBody = firstParagraph(baseline);
        if (profile != null) {
            String goal = plainGoalTitle(profile);
            if (goal != null) {
                summaryBody = goal;
            }
        }
        if (!summaryBody.isBlank()) {
            sections.add(new CvMarkdownSections.Section("Professional summary", summaryBody));
        }

        String experience = formatExperienceFromProfile(profile);
        if (experience.isBlank()) {
            experience = extractExperienceChunk(baseline);
        }
        if (!experience.isBlank()) {
            sections.add(new CvMarkdownSections.Section("Professional experience", experience));
        }

        String skills = formatSkillsFromProfile(profile);
        if (!skills.isBlank()) {
            sections.add(new CvMarkdownSections.Section("Skills", skills));
        }

        String education = formatEducationFromProfile(profile);
        if (!education.isBlank()) {
            sections.add(new CvMarkdownSections.Section("Education", education));
        }

        if (sections.isEmpty() && baseline != null && !baseline.isBlank()) {
            sections.add(new CvMarkdownSections.Section("Professional summary", truncate(baseline, 1500)));
        }
        return sections;
    }

    private static String whoYouAreSentence(UserProfile profile, Job job, boolean techRole) {
        String identity = professionalIdentity(profile, job, techRole);
        String tenure = tenurePhrase(profile);
        if (tenure.isBlank()) {
            return identity + ".";
        }
        return identity + " with " + tenure + ".";
    }

    private static String skillsSentence(
            List<String> matched,
            UserProfile profile,
            Job job,
            boolean techRole) {
        List<String> terms = new ArrayList<>();
        if (!matched.isEmpty()) {
            terms.addAll(matched.stream().limit(5).toList());
        } else if (profile != null && profile.getTechStack() != null) {
            for (String s : profile.getTechStack()) {
                if (s != null && !s.isBlank()) {
                    terms.add(s.trim());
                }
                if (terms.size() >= 5) break;
            }
        }
        if (terms.isEmpty() && profile != null && profile.getSectors() != null && profile.getSectors().length > 0) {
            terms.add(profile.getSectors()[0]);
        }

        String role = job != null ? safe(job.getTitle()) : "this role";
        if (terms.isEmpty()) {
            return techRole
                ? "Skilled in end-to-end delivery and cross-functional collaboration relevant to " + role + "."
                : "Offers relevant expertise and a consistent track record aligned to " + role + ".";
        }
        String joined = String.join(", ", terms);
        return techRole
            ? "Core strengths include " + joined + ", applied in production settings that match this role."
            : "Brings demonstrated capability in " + joined + " from recent roles directly relevant to this position.";
    }

    private static String valueSentence(String role, String company, boolean techRole) {
        if (techRole) {
            return "Positioned to help " + company + " deliver on " + role
                + " priorities through reliable execution and measurable results.";
        }
        return "Ready to contribute to " + company + " as " + role
            + " with dependable delivery and outcomes aligned to the organisation's goals.";
    }

    private static String professionalIdentity(UserProfile profile, Job job, boolean techRole) {
        String goal = profile != null ? plainGoalTitle(profile) : null;
        if (goal != null && !goal.isBlank()) {
            return capitalizeFirst(goal);
        }
        if (profile != null && profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            String target = profile.getTargetRoles()[0].trim();
            if (!target.isBlank()) {
                return capitalizeFirst(target);
            }
        }
        if (techRole && job != null) {
            return ApplyAssistService.inferRoleLabel(job, profile);
        }
        if (job != null && job.getTitle() != null && !job.getTitle().isBlank()) {
            return capitalizeFirst(job.getTitle().trim());
        }
        return "Experienced professional";
    }

    private static String tenurePhrase(UserProfile profile) {
        if (profile == null || profile.getExperienceLevel() == null) {
            return "";
        }
        return switch (profile.getExperienceLevel().trim().toLowerCase(Locale.ROOT)) {
            case "junior" -> "early-career experience";
            case "mid" -> "4+ years of professional experience";
            case "senior" -> "6+ years of professional experience";
            case "lead", "principal" -> "8+ years of professional experience";
            default -> "";
        };
    }

    static boolean looksTechRole(Job job, UserProfile profile) {
        String hay = jobHaystack(job);
        if (hay.contains("engineer") || hay.contains("developer") || hay.contains("software")
            || hay.contains("devops") || hay.contains("full stack") || hay.contains("fullstack")
            || hay.contains("programmer") || hay.contains("data scientist") || hay.contains("sre")
            || hay.contains("frontend") || hay.contains("backend")) {
            return true;
        }
        if (profile != null && profile.getTechStack() != null && profile.getTechStack().length > 0) {
            return true;
        }
        return false;
    }

    private static String formatExperienceFromProfile(UserProfile profile) {
        if (profile == null || profile.getWorkExperience() == null || profile.getWorkExperience().isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (UserProfile.WorkExperienceEntry w : profile.getWorkExperience()) {
            sb.append(nullSafe(w.getJobTitle()));
            if (!nullSafe(w.getCompanyName()).isBlank()) {
                sb.append(" — ").append(nullSafe(w.getCompanyName()));
            }
            sb.append("\n");
            if (w.getStartDate() != null || w.getEndDate() != null || w.isCurrent()) {
                sb.append(nullSafe(w.getStartDate())).append(" – ")
                    .append(w.isCurrent() ? "Present" : nullSafe(w.getEndDate())).append("\n");
            }
            if (w.getDescription() != null && !w.getDescription().isBlank()) {
                for (String line : w.getDescription().split("\\r?\\n")) {
                    String t = line.trim();
                    if (t.isBlank()) continue;
                    sb.append(t.startsWith("-") || t.startsWith("•") ? t : "• " + t).append("\n");
                }
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private static String formatSkillsFromProfile(UserProfile profile) {
        if (profile == null || profile.getTechStack() == null || profile.getTechStack().length == 0) {
            return "";
        }
        LinkedHashSet<String> skills = new LinkedHashSet<>();
        for (String s : profile.getTechStack()) {
            if (s != null && !s.isBlank()) {
                skills.add(s.trim());
            }
        }
        return String.join(" · ", skills);
    }

    private static String formatEducationFromProfile(UserProfile profile) {
        if (profile == null || profile.getEducation() == null || profile.getEducation().isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (UserProfile.EducationEntry e : profile.getEducation()) {
            sb.append("- ").append(nullSafe(e.getDegree()));
            if (!nullSafe(e.getSchoolName()).isBlank()) {
                sb.append(", ").append(nullSafe(e.getSchoolName()));
            }
            if (e.getGraduationYear() != null && !e.getGraduationYear().isBlank()) {
                sb.append(" (").append(e.getGraduationYear()).append(")");
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private static String extractExperienceChunk(String baseline) {
        if (baseline == null || baseline.isBlank()) {
            return "";
        }
        String lower = baseline.toLowerCase(Locale.ROOT);
        int idx = indexOfAny(lower, "professional experience", "work experience", "experience\n", "employment");
        if (idx < 0) {
            return truncate(baseline, 4000);
        }
        return truncate(baseline.substring(idx), 6000);
    }

    private static int indexOfAny(String haystack, String... needles) {
        int best = -1;
        for (String n : needles) {
            int i = haystack.indexOf(n);
            if (i >= 0 && (best < 0 || i < best)) {
                best = i;
            }
        }
        return best;
    }

    private static boolean isStructuralOnlySection(String name) {
        if (name == null) return true;
        String lower = name.trim().toLowerCase(Locale.ROOT);
        return lower.equals("header") || lower.equals("contact")
            || lower.equals("cv") || lower.equals("resume") || lower.equals("curriculum vitae");
    }

    private static String plainGoalTitle(UserProfile profile) {
        if (profile == null) return null;
        String g = profile.getGoalTitle();
        if (g == null || g.isBlank()) return null;
        if (AesGcmCodec.looksEncrypted(g.trim())) return null;
        return g.trim();
    }

    private static String firstParagraph(String text) {
        if (text == null || text.isBlank()) return "";
        String t = text.replace("\r", "").trim();
        int idx = t.indexOf("\n\n");
        String chunk = idx > 0 ? t.substring(0, idx) : t;
        return truncate(chunk, 600);
    }

    private static String capitalizeFirst(String s) {
        if (s == null || s.isBlank()) return s;
        if (s.length() == 1) return s.toUpperCase(Locale.ROOT);
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String jobHaystack(Job job) {
        if (job == null) return "";
        return ((job.getTitle() == null ? "" : job.getTitle()) + "\n"
            + (job.getDescription() == null ? "" : job.getDescription())).toLowerCase(Locale.ROOT);
    }

    private static String nullSafe(String s) {
        return s == null ? "" : s.trim();
    }

    private static String safe(String s) {
        return s == null || s.isBlank() ? "—" : s.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
