package com.careerops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.careerops.model.Job;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.JobRepository;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.jsoup.Jsoup;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Deterministic CV ↔ job skill matching for evaluations and job detail UI.
 * <p>
 * Algorithm (JD-first):
 * <ol>
 *   <li>Extract required skills from the job title + description</li>
 *   <li>For each JD skill, check if it appears anywhere in the full CV text</li>
 *   <li>Present in CV → matched (green); absent → gap (red)</li>
 * </ol>
 */
@Service
public class UserJobSkillMatchService {

    private final CvSkillExtractionService skillExtraction;
    private final UserCvRepository cvRepo;
    private final UserProfileRepository profiles;
    private final UserJobRepository userJobs;
    private final JobRepository jobs;

    public UserJobSkillMatchService(
            CvSkillExtractionService skillExtraction,
            UserCvRepository cvRepo,
            UserProfileRepository profiles,
            UserJobRepository userJobs,
            JobRepository jobs,
            JobMatchingService jobMatcher) {
        this.skillExtraction = skillExtraction;
        this.cvRepo = cvRepo;
        this.profiles = profiles;
        this.userJobs = userJobs;
        this.jobs = jobs;
    }

    public record SkillMatch(List<String> userSkills, List<String> matched, List<String> gaps) {}

    public SkillMatch compute(UserProfile profile, String cvText, Job job) {
        String postingPlain = plainPostingText(job);
        CvSkillExtractionService.JdCvSkillMatch jdMatch =
            skillExtraction.matchJobDescriptionToCv(postingPlain, cvText);
        List<String> userSkills = skillExtraction.extractForUser(null, profile, cvText);
        return new SkillMatch(userSkills, jdMatch.matchedInCv(), jdMatch.missingFromCv());
    }

    static String plainPostingText(Job job) {
        if (job == null) return "";
        String title = job.getTitle() == null ? "" : job.getTitle();
        String desc = job.getDescription() == null ? "" : job.getDescription();
        if (desc.contains("<")) {
            desc = Jsoup.parse(desc).text();
        }
        return (title + "\n" + desc).trim();
    }

    public SkillMatch computeForUser(UUID userId, Job job) {
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText = activeCvText(userId);
        return compute(profile, cvText, job);
    }

    @Transactional
    public void refreshAndPersist(UserJob uj, Job job) {
        SkillMatch match = computeForUser(uj.getUserId(), job);
        uj.setMatchedSkills(toArray(match.matched()));
        uj.setUnmatchedSkills(toArray(match.gaps()));
        JsonNode breakdown = uj.getScoreBreakdown();
        if (breakdown != null && breakdown.isObject()) {
            ObjectNode updated = breakdown.deepCopy();
            overlayOnReport(updated, match);
            uj.setScoreBreakdown(updated);
        }
        userJobs.save(uj);
    }

    @Transactional
    public void refreshAllForUser(UUID userId) {
        UserProfile profile = profiles.findByUserId(userId).orElse(null);
        String cvText = activeCvText(userId);
        for (UserJob uj : userJobs.findByUserIdOrderByDeliveredAtDesc(userId, Pageable.unpaged()).getContent()) {
            jobs.findById(uj.getJobId()).ifPresent(job -> {
                SkillMatch match = compute(profile, cvText, job);
                uj.setMatchedSkills(toArray(match.matched()));
                uj.setUnmatchedSkills(toArray(match.gaps()));
                JsonNode breakdown = uj.getScoreBreakdown();
                if (breakdown != null && breakdown.isObject()) {
                    ObjectNode updated = breakdown.deepCopy();
                    overlayOnReport(updated, match);
                    uj.setScoreBreakdown(updated);
                }
                userJobs.save(uj);
            });
        }
    }

    public static String jobHaystack(Job job) {
        return plainPostingText(job).toLowerCase(Locale.ROOT);
    }

    private String activeCvText(UUID userId) {
        if (cvRepo == null) return "";
        var active = cvRepo.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId);
        if (active.isPresent()) {
            String text = cvTextForAi(active.get());
            if (!text.isBlank()) return text;
        }
        return cvRepo.findByUserIdOrderByUploadedAtDesc(userId).stream()
            .map(this::cvTextForAi)
            .filter(t -> t != null && !t.isBlank())
            .findFirst()
            .orElse("");
    }

    private String cvTextForAi(UserCv cv) {
        if (cv.getCvMarkdown() != null && !cv.getCvMarkdown().isBlank()) {
            return cv.getCvMarkdown();
        }
        return cv.getParsedText() != null ? cv.getParsedText() : "";
    }

    private static String[] toArray(List<String> skills) {
        if (skills == null || skills.isEmpty()) return new String[0];
        return skills.toArray(new String[0]);
    }

    public ObjectNode overlayOnReport(ObjectNode report, SkillMatch match) {
        var matchedArr = report.putArray("matchedSkills");
        match.matched().forEach(matchedArr::add);
        var gapsArr = report.putArray("unmatchedSkills");
        match.gaps().forEach(gapsArr::add);
        return report;
    }
}
