package com.careerops.service;

import com.careerops.model.Job;
import com.careerops.model.Profile;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Task 141 — JobMatchingService tests
 * Covers: score calculation, top-5 selection,
 *         no-CV fallback returns jobs without matching.
 */
@ExtendWith(MockitoExtension.class)
class JobMatchingServiceTest {

    @Mock  private ProfileRepository     profileRepository;
    @Mock  private UserJobRepository     userJobRepository;
    @InjectMocks private JobMatchingService service;

    // ── 1. Score calculation: exact tech-stack overlap → high score ────────
    @Test
    @DisplayName("score calc — exact tech overlap gives score ≥ 70")
    void scoreCalc_exactOverlapGivesHighScore() {
        Profile profile = new Profile();
        profile.setTechStack(List.of("React", "TypeScript", "Node.js"));
        profile.setTargetRoles(List.of("Frontend Engineer"));

        Job job = new Job();
        job.setRequiredSkills(List.of("React", "TypeScript", "Node.js"));
        job.setTitle("Senior Frontend Engineer");

        int score = service.calcMatchScore(profile, job);
        assertThat(score).isGreaterThanOrEqualTo(70);
    }

    // ── 2. Top-5 selection returns at most 5 jobs ─────────────────────────
    @Test
    @DisplayName("top-5 selection — returns at most 5 jobs")
    void topFiveSelection_returnsAtMostFive() {
        Profile profile = new Profile();
        profile.setTechStack(List.of("Java"));
        profile.setActiveCvFileName("cv.pdf");

        when(profileRepository.findByUserId("user-1")).thenReturn(Optional.of(profile));

        // Build 10 jobs
        List<Job> tenJobs = java.util.stream.IntStream.range(0, 10)
            .mapToObj(i -> { Job j = new Job(); j.setTitle("Job " + i); j.setRequiredSkills(List.of("Java")); return j; })
            .toList();

        List<Job> top5 = service.topMatches("user-1", tenJobs, 5);
        assertThat(top5).hasSizeLessThanOrEqualTo(5);
    }

    // ── 3. No-CV fallback — returns jobs without CV-based matching ─────────
    @Test
    @DisplayName("no-CV fallback — returns jobs even without CV")
    void noCvFallback_returnsJobsWithoutCv() {
        Profile profile = new Profile();
        profile.setActiveCvFileName(null); // no CV
        profile.setTechStack(List.of());

        when(profileRepository.findByUserId("user-2")).thenReturn(Optional.of(profile));

        List<Job> jobs = List.of(new Job(), new Job(), new Job());
        List<Job> result = service.topMatches("user-2", jobs, 5);

        // Should return all 3 with neutral score rather than nothing
        assertThat(result).hasSize(3);
    }
}
