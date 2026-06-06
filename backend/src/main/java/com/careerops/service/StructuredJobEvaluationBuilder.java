package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.UserProfile;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Builds EvaluationReport v2 JSON locally (CV + profile + JD) when NVIDIA is slow,
 * partial, or unavailable — so the UI always has a substantive report.
 */
@Component
public class StructuredJobEvaluationBuilder {

    private static final List<DimensionDef> DIMENSIONS = List.of(
        new DimensionDef("role_fit", "Role fit"),
        new DimensionDef("skills_match", "Skills match"),
        new DimensionDef("experience_depth", "Experience depth"),
        new DimensionDef("cv_evidence", "CV evidence"),
        new DimensionDef("location_work_model", "Location & work model"),
        new DimensionDef("compensation", "Compensation"),
        new DimensionDef("sponsorship_visa", "Sponsorship / visa"),
        new DimensionDef("company_stage", "Company stage"),
        new DimensionDef("growth_learning", "Growth & learning"),
        new DimensionDef("culture_signals", "Culture signals")
    );

    private final CvSkillExtractionService skillExtraction;
    private final UserJobSkillMatchService skillMatchService;
    private final JobMatchingService jobMatcher;
    private final EvaluationReportValidator evaluationValidator;
    private final ObjectMapper mapper;

    public StructuredJobEvaluationBuilder(
            CvSkillExtractionService skillExtraction,
            UserJobSkillMatchService skillMatchService,
            JobMatchingService jobMatcher,
            EvaluationReportValidator evaluationValidator,
            ObjectMapper mapper) {
        this.skillExtraction = skillExtraction;
        this.skillMatchService = skillMatchService;
        this.jobMatcher = jobMatcher;
        this.evaluationValidator = evaluationValidator;
        this.mapper = mapper;
    }

    public JsonNode build(
            UUID userId,
            Job job,
            UserProfile profile,
            @Nullable String cvText,
            @Nullable JobMatchingService.ScoredJob ranked,
            String source,
            String evaluationStatus) {
        JobMatchingService.ScoredJob scored = ranked != null
            ? ranked
            : jobMatcher.topN(List.of(job), profile, 1).stream().findFirst().orElse(null);

        int preRank = scored != null ? scored.score() : 50;
        int match = Math.min(95, Math.max(0, preRank));

        UserJobSkillMatchService.SkillMatch skillMatch = skillMatchService.compute(profile, cvText, job);
        List<String> skills = skillMatch.userSkills();
        List<String> matched = new ArrayList<>(skillMatch.matched());
        if (matched.isEmpty() && scored != null && !scored.matchedTerms().isEmpty()) {
            matched = CvSkillCanonical.dedupeCanonical(new ArrayList<>(scored.matchedTerms()));
        }
        List<String> gapsInPosting = new ArrayList<>(skillMatch.gaps());
        List<String> unmatched = gapsInPosting;
        String jobHay = jobHaystack(job);
        if (unmatched.isEmpty()) {
            unmatched = CvSkillCanonical.dedupeCanonical(
                skillExtraction.unmatchedInJob(skills, jobHay));
        }
        if (unmatched.isEmpty()) {
            unmatched = unmatchedStack(profile, matched);
        }

        ObjectNode raw = mapper.createObjectNode();
        raw.put("matchPercent", match);
        raw.put("overallScore", match);
        raw.put("verdict", verdictFor(match));
        raw.put("evaluationStatus", evaluationStatus);
        raw.put("humanSummary", humanSummary(job, profile, match, matched, unmatched));

        ArrayNode matchedArr = raw.putArray("matchedSkills");
        matched.forEach(matchedArr::add);
        ArrayNode unmatchedArr = raw.putArray("unmatchedSkills");
        unmatched.forEach(unmatchedArr::add);

        ArrayNode tips = raw.putArray("cvImprovementTips");
        CvResumeCoachTips.build(job, profile, matched, gapsInPosting, match).forEach(tips::add);

        ArrayNode nextSteps = raw.putArray("nextSteps");
        buildNextSteps(job, matched, unmatched, match).forEach(nextSteps::add);

        boolean sponsorshipOk = sponsorshipAligned(profile, job);
        boolean salaryOk = salaryAligned(profile, job);
        raw.put("sponsorshipMatch", sponsorshipOk);
        raw.put("salaryMatch", salaryOk);

        ArrayNode dimensions = raw.putArray("dimensions");
        double skillsScore = skillsDimensionScore(skills, matched);
        double roleScore = roleDimensionScore(profile, job, scored);
        double locationScore = locationDimensionScore(profile, job, scored);
        double compScore = compensationDimensionScore(profile, job, scored);
        double cvEvidenceScore = cvEvidenceScore(matched, skills, cvText);
        double sponsorshipScore = sponsorshipOk ? 4.2 : (Boolean.TRUE.equals(profile.getSponsorshipRequired()) ? 2.0 : 3.5);
        double experienceScore = experienceDepthScore(profile, job, cvText);

        addDimension(dimensions, "role_fit", roleScore, roleReason(profile, job, scored));
        addDimension(dimensions, "skills_match", skillsScore, skillsReason(matched, skills));
        addDimension(dimensions, "experience_depth", experienceScore, experienceReason(profile, job));
        addDimension(dimensions, "cv_evidence", cvEvidenceScore, cvEvidenceReason(matched, cvText));
        addDimension(dimensions, "location_work_model", locationScore, locationReason(profile, job, scored));
        addDimension(dimensions, "compensation", compScore, compensationReason(profile, job, scored));
        addDimension(dimensions, "sponsorship_visa", sponsorshipScore, sponsorshipReason(profile, job, sponsorshipOk));
        addDimension(dimensions, "company_stage", 3.4, "Assess company size and funding in your research before applying.");
        addDimension(dimensions, "growth_learning", 3.6, growthReason(job));
        addDimension(dimensions, "culture_signals", 3.3, "Review values, team structure, and ways of working mentioned in the posting.");

        ObjectNode sections = raw.putObject("sections");
        sections.put("executiveSummary", executiveSummary(job, profile, match, matched, unmatched, scored));
        sections.put("backgroundMatch", backgroundMatch(job, matched, unmatched, cvText));
        sections.put("positioningStrategy", positioningStrategy(job, profile, matched, unmatched));
        sections.put("compensationAndMarket", compensationSection(profile, job, salaryOk));
        sections.put("tailoringPlan", tailoringPlan(job, matched, unmatched));
        sections.put("interviewPrep", interviewPrep(job, matched, unmatched));

        return evaluationValidator.normalize(raw, source).report();
    }

    private static String jobHaystack(Job job) {
        return ((job.getTitle() == null ? "" : job.getTitle()) + "\n"
            + (job.getDescription() == null ? "" : job.getDescription())).toLowerCase(Locale.ROOT);
    }

    private static List<String> unmatchedStack(UserProfile profile, List<String> matched) {
        if (profile.getTechStack() == null) return List.of();
        var matchedCanon = matched.stream()
            .map(CvSkillCanonical::canonicalize)
            .collect(java.util.stream.Collectors.toSet());
        List<String> out = new ArrayList<>();
        for (String skill : profile.getTechStack()) {
            if (skill == null || skill.isBlank()) continue;
            String canon = CvSkillCanonical.canonicalize(skill);
            if (!matchedCanon.contains(canon)) {
                out.add(canon);
            }
        }
        return CvSkillCanonical.dedupeCanonical(out);
    }

    private static List<String> buildNextSteps(Job job, List<String> matched, List<String> unmatched, int match) {
        List<String> steps = new ArrayList<>();
        if (!matched.isEmpty()) {
            steps.add("Lead with matched skills in your summary and first experience bullet: "
                + String.join(", ", matched.stream().limit(6).toList()) + ".");
        }
        if (!unmatched.isEmpty()) {
            steps.add("Address gaps only where your CV already has evidence — do not invent: "
                + String.join(", ", unmatched.stream().limit(5).toList()) + ".");
        } else if (matched.isEmpty()) {
            steps.add("Upload or refresh your CV in Settings — limited overlap was detected with this posting.");
        }
        steps.add("Run Tailor my CV to generate a role-specific PDF before applying.");
        if (match < 68) {
            steps.add("Match is below 68% — consider whether " + safe(job.getTitle())
                + " aligns with your target roles before investing deep prep time.");
        } else {
            steps.add("Proceed to application when your tailored CV and cover letter reflect the posting language.");
        }
        return steps;
    }

    private static String verdictFor(int match) {
        if (match >= 82) return "Strong fit — worth applying";
        if (match >= 68) return "Worth applying";
        if (match >= 55) return "Stretch role — targeted application";
        return "Low match — deprioritise unless strategic";
    }

    private static String humanSummary(Job job, UserProfile profile, int match,
            List<String> matched, List<String> unmatched) {
        String title = safe(job.getTitle());
        String company = safe(job.getCompany());
        String headline = profile.getGoalTitle() != null && !profile.getGoalTitle().isBlank()
                ? profile.getGoalTitle().trim() : null;
        if (matched.isEmpty()) {
            String base = "Limited overlap between your CV/profile and "
                + title + " at " + company + " (" + match + "%). Review gaps before investing application time.";
            return headline != null ? "Headline: " + headline + ". " + base : base;
        }
        String base = "Your background aligns with " + matched.size() + " core signals for "
            + title + " at " + company + " (" + match + "%). "
            + (unmatched.isEmpty()
                ? "No major stack gaps detected in the posting text."
                : unmatched.size() + " profile skills need stronger evidence in your CV.");
        return headline != null ? "Headline: " + headline + ". " + base : base;
    }

    private static String executiveSummary(Job job, UserProfile profile, int match,
            List<String> matched, List<String> unmatched,
            @Nullable JobMatchingService.ScoredJob scored) {
        StringBuilder sb = new StringBuilder();
        if (profile.getGoalTitle() != null && !profile.getGoalTitle().isBlank()) {
            sb.append("Headline: ").append(profile.getGoalTitle().trim()).append(". ");
        }
        sb.append(safe(job.getTitle())).append(" at ").append(safe(job.getCompany()));
        sb.append(" scores ").append(match).append("% against your profile");
        if (profile.getLocation() != null && !profile.getLocation().isBlank()) {
            sb.append(" (target location: ").append(profile.getLocation()).append(")");
        }
        sb.append(". ");
        if (scored != null && !scored.reasons().isEmpty()) {
            sb.append(String.join(". ", scored.reasons())).append(". ");
        }
        if (!matched.isEmpty()) {
            sb.append("Strongest signals: ").append(String.join(", ", matched.stream().limit(8).toList())).append(". ");
        }
        if (!unmatched.isEmpty()) {
            sb.append("Close gaps on: ").append(String.join(", ", unmatched.stream().limit(6).toList())).append(".");
        } else {
            sb.append("No major keyword gaps detected in the posting.");
        }
        return sb.toString().trim();
    }

    private static String backgroundMatch(Job job, List<String> matched, List<String> unmatched, @Nullable String cvText) {
        StringBuilder sb = new StringBuilder();
        sb.append("Requirement scan for ").append(safe(job.getTitle())).append(":\n\n");
        List<String> reqs = extractRequirementLines(job.getDescription());
        if (reqs.isEmpty()) {
            sb.append("• Posting text is short — focus on title and stack overlap.\n");
        } else {
            int i = 1;
            for (String req : reqs.stream().limit(8).toList()) {
                String strength = classifyRequirement(req, matched, unmatched, cvText);
                sb.append(i++).append(". ").append(req.trim()).append(" → ").append(strength).append("\n");
            }
        }
        sb.append("\nMatched profile/CV signals: ");
        sb.append(matched.isEmpty() ? "none detected" : String.join(", ", matched));
        if (!unmatched.isEmpty()) {
            sb.append("\nGaps to address: ").append(String.join(", ", unmatched));
        }
        return sb.toString().trim();
    }

    private static List<String> extractRequirementLines(@Nullable String description) {
        if (description == null || description.isBlank()) return List.of();
        List<String> lines = new ArrayList<>();
        for (String line : description.split("\\r?\\n")) {
            String t = line.strip();
            if (t.length() < 24) continue;
            String lower = t.toLowerCase(Locale.ROOT);
            if (lower.contains("require") || lower.contains("experience")
                || lower.contains("proficient") || lower.contains("knowledge")
                || lower.contains("years") || t.startsWith("•") || t.startsWith("-")
                || t.matches("^\\d+\\..*")) {
                lines.add(t.replaceFirst("^[•\\-–]\\s*", ""));
            }
        }
        if (lines.size() < 3) {
            for (String line : description.split("\\r?\\n")) {
                String t = line.strip();
                if (t.length() >= 40 && lines.size() < 8 && !lines.contains(t)) {
                    lines.add(t);
                }
            }
        }
        return lines;
    }

    private static String classifyRequirement(String req, List<String> matched, List<String> unmatched, @Nullable String cvText) {
        String lower = req.toLowerCase(Locale.ROOT);
        for (String m : matched) {
            if (lower.contains(m.toLowerCase(Locale.ROOT))) {
                return "Strong — " + m + " appears in posting and your profile";
            }
        }
        if (cvText != null) {
            String cvLower = cvText.toLowerCase(Locale.ROOT);
            for (String m : matched) {
                if (cvLower.contains(m.toLowerCase(Locale.ROOT))) {
                    return "Partial — " + m + " in CV; emphasise in application";
                }
            }
        }
        for (String u : unmatched) {
            if (lower.contains(u.toLowerCase(Locale.ROOT))) {
                return "Gap — " + u + " not evidenced; add proof or adjacent experience";
            }
        }
        return "Review — map to your closest project experience";
    }

    private static String positioningStrategy(Job job, UserProfile profile, List<String> matched, List<String> unmatched) {
        StringBuilder sb = new StringBuilder();
        if (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0) {
            sb.append("Frame yourself as ").append(profile.getTargetRoles()[0]).append(" ");
        }
        sb.append("applying to ").append(safe(job.getCompany())).append(": ");
        if (!matched.isEmpty()) {
            sb.append("anchor the narrative on ").append(String.join(" and ", matched.stream().limit(3).toList()));
            sb.append(" with quantified outcomes. ");
        }
        if (!unmatched.isEmpty()) {
            sb.append("For ").append(String.join(", ", unmatched.stream().limit(4).toList()));
            sb.append(", use transferable projects rather than claiming expertise you cannot defend in interview.");
        } else {
            sb.append("Stress scope, ownership, and business impact in your top two roles.");
        }
        return sb.toString().trim();
    }

    private static String compensationSection(UserProfile profile, Job job, boolean salaryOk) {
        StringBuilder sb = new StringBuilder();
        if (job.getSalaryMin() != null || job.getSalaryMax() != null) {
            sb.append("Posting range: ");
            if (job.getSalaryMin() != null) sb.append(job.getSalaryMin());
            sb.append("–");
            if (job.getSalaryMax() != null) sb.append(job.getSalaryMax());
            if (job.getCurrency() != null) sb.append(" ").append(job.getCurrency());
            sb.append(". ");
        } else {
            sb.append("Salary not listed — research market rate before screening call. ");
        }
        if (profile.getSalaryMin() != null) {
            sb.append("Your target floor: ").append(profile.getSalaryMin());
            if (profile.getSalaryCurrency() != null) sb.append(" ").append(profile.getSalaryCurrency());
            sb.append(". ");
        }
        sb.append(salaryOk
            ? "Range appears compatible with your stated expectations."
            : "Verify total comp (base + bonus + benefits) — listed range may sit below your target.");
        return sb.toString().trim();
    }

    private static String tailoringPlan(Job job, List<String> matched, List<String> unmatched) {
        StringBuilder sb = new StringBuilder();
        sb.append("1. Headline: include \"").append(safe(job.getTitle())).append("\" + top stack (");
        sb.append(matched.isEmpty() ? "your core skills" : String.join(", ", matched.stream().limit(4).toList()));
        sb.append(").\n");
        sb.append("2. Summary: 3 lines — role fit, domain, and one measurable win.\n");
        if (!unmatched.isEmpty()) {
            sb.append("3. Skills section: add ").append(String.join(", ", unmatched.stream().limit(4).toList()));
            sb.append(" only where your CV already supports them.\n");
        }
        sb.append("4. Mirror language from the posting's first three responsibility bullets.\n");
        sb.append("5. Export a role-specific PDF before applying.");
        return sb.toString();
    }

    private static String interviewPrep(Job job, List<String> matched, List<String> unmatched) {
        StringBuilder sb = new StringBuilder();
        sb.append("Prepare STAR stories for:\n");
        int n = 1;
        for (String m : matched.stream().limit(4).toList()) {
            sb.append(n++).append(". ").append(m).append(" — delivery, scale, and trade-offs.\n");
        }
        for (String u : unmatched.stream().limit(3).toList()) {
            sb.append(n++).append(". How you would ramp on ").append(u).append(" if asked.\n");
        }
        sb.append(n).append(". Why ").append(safe(job.getCompany())).append(" and this ").append(safe(job.getTitle()));
        sb.append(" role now.\n");
        sb.append(n + 1).append(". Questions for them: team structure, success metrics, and hiring timeline.");
        return sb.toString().trim();
    }

    private static boolean sponsorshipAligned(UserProfile profile, Job job) {
        if (!Boolean.TRUE.equals(profile.getSponsorshipRequired())) return true;
        return Boolean.TRUE.equals(job.getSponsorship());
    }

    private static boolean salaryAligned(UserProfile profile, Job job) {
        if (profile.getSalaryMin() == null) return true;
        if (job.getSalaryMax() == null) return true;
        return job.getSalaryMax() >= profile.getSalaryMin();
    }

    private static double skillsDimensionScore(List<String> skills, List<String> matched) {
        if (skills.isEmpty()) return matched.isEmpty() ? 2.5 : 3.5;
        double ratio = (double) matched.size() / skills.size();
        return clamp(1.5 + ratio * 3.5);
    }

    private static double roleDimensionScore(UserProfile profile, Job job, @Nullable JobMatchingService.ScoredJob scored) {
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("Exact role"))) return 4.5;
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("Partial role"))) return 3.6;
        String title = job.getTitle() == null ? "" : job.getTitle().toLowerCase(Locale.ROOT);
        if (profile.getTargetRoles() != null) {
            for (String role : profile.getTargetRoles()) {
                if (role != null && title.contains(role.toLowerCase(Locale.ROOT).split("\\s+")[0])) return 3.8;
            }
        }
        return 3.0;
    }

    private static double locationDimensionScore(UserProfile profile, Job job, @Nullable JobMatchingService.ScoredJob scored) {
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("Location"))) return 4.3;
        return 3.0;
    }

    private static double compensationDimensionScore(UserProfile profile, Job job, @Nullable JobMatchingService.ScoredJob scored) {
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("Salary"))) return 4.0;
        return salaryAligned(profile, job) ? 3.8 : 2.8;
    }

    private static double cvEvidenceScore(List<String> matched, List<String> skills, @Nullable String cvText) {
        if (cvText == null || cvText.isBlank() || matched.isEmpty()) return 2.8;
        String cvLower = cvText.toLowerCase(Locale.ROOT);
        long inCv = matched.stream().filter(m -> cvLower.contains(m.toLowerCase(Locale.ROOT))).count();
        double ratio = skills.isEmpty() ? (double) inCv / matched.size() : (double) inCv / Math.max(1, skills.size());
        return clamp(2.0 + ratio * 3.0);
    }

    private static double experienceDepthScore(UserProfile profile, Job job, @Nullable String cvText) {
        String title = job.getTitle() == null ? "" : job.getTitle().toLowerCase(Locale.ROOT);
        boolean seniorRole = title.contains("senior") || title.contains("lead") || title.contains("principal");
        if (cvText != null && seniorRole && cvText.toLowerCase(Locale.ROOT).contains("senior")) return 4.0;
        return seniorRole ? 3.2 : 3.6;
    }

    private void addDimension(ArrayNode arr, String key, double score, String reason) {
        ObjectNode dim = mapper.createObjectNode();
        dim.put("key", key);
        dim.put("label", labelFor(key));
        dim.put("score", clamp(score));
        dim.put("weight", 0.1);
        dim.put("reason", reason.length() > 280 ? reason.substring(0, 277) + "..." : reason);
        arr.add(dim);
    }

    private static String labelFor(String key) {
        return DIMENSIONS.stream().filter(d -> d.key().equals(key)).map(DimensionDef::label).findFirst().orElse(key);
    }

    private static double clamp(double s) {
        return Math.max(0, Math.min(5, Math.round(s * 10.0) / 10.0));
    }

    private static String safe(@Nullable String s) {
        return s == null || s.isBlank() ? "this role" : s.trim();
    }

    private static String roleReason(UserProfile profile, Job job, @Nullable JobMatchingService.ScoredJob scored) {
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("role"))) {
            return scored.reasons().stream().filter(r -> r.contains("role")).findFirst().orElse("Title overlap with target roles.");
        }
        return "Compare \"" + safe(job.getTitle()) + "\" with your target roles: "
            + (profile.getTargetRoles() != null && profile.getTargetRoles().length > 0
                ? profile.getTargetRoles()[0] : "not set");
    }

    private static String skillsReason(List<String> matched, List<String> skills) {
        return matched.size() + " of " + Math.max(skills.size(), matched.size())
            + " profile/CV skills appear in the posting: " + String.join(", ", matched.stream().limit(6).toList());
    }

    private static String experienceReason(UserProfile profile, Job job) {
        return "Seniority signals in \"" + safe(job.getTitle()) + "\" vs your stated level ("
            + (profile.getExperienceLevel() != null ? profile.getExperienceLevel() : "profile") + ").";
    }

    private static String cvEvidenceReason(List<String> matched, @Nullable String cvText) {
        if (cvText == null || cvText.isBlank()) return "Upload a CV to strengthen evidence scoring.";
        return "Matched skills traced against your CV text (" + matched.size() + " hits).";
    }

    private static String locationReason(UserProfile profile, Job job, @Nullable JobMatchingService.ScoredJob scored) {
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("Location"))) {
            return scored.reasons().stream().filter(r -> r.contains("Location")).findFirst().get();
        }
        return "Posting location \"" + safe(job.getLocation()) + "\" vs preference \"" + safe(profile.getLocation()) + "\".";
    }

    private static String compensationReason(UserProfile profile, Job job, @Nullable JobMatchingService.ScoredJob scored) {
        if (scored != null && scored.reasons().stream().anyMatch(r -> r.contains("Salary"))) {
            return scored.reasons().stream().filter(r -> r.contains("Salary")).findFirst().get();
        }
        return compensationSection(profile, job, salaryAligned(profile, job));
    }

    private static String sponsorshipReason(UserProfile profile, Job job, boolean ok) {
        if (!Boolean.TRUE.equals(profile.getSponsorshipRequired())) {
            return "Sponsorship not required on your profile.";
        }
        return ok
            ? "Posting indicates sponsorship may be available."
            : "You need sponsorship; not clearly offered — confirm with recruiter.";
    }

    private static String growthReason(Job job) {
        String d = job.getDescription() == null ? "" : job.getDescription().toLowerCase(Locale.ROOT);
        if (d.contains("growth") || d.contains("learning") || d.contains("career")) {
            return "Posting mentions growth or learning opportunities.";
        }
        return "Check leveling, mentorship, and scope expansion during interviews.";
    }

    private record DimensionDef(String key, String label) {}
}
