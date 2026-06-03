package com.careerops.service;

import com.careerops.model.UserProfile;
import com.careerops.model.JobListing;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.JobListingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Drives the initial job delivery triggered at the end of onboarding.
 * Reads the user's maxAgeDays preference and passes it to the scraper.
 */
@Service
public class OnboardingDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(OnboardingDeliveryService.class);
    private static final int DEFAULT_MAX_AGE_DAYS = 7;

    private final JobScrapeService jobScrapeService;
    private final JobMatchingService jobMatchingService;
    private final JobListingRepository jobListingRepository;
    private final UserProfileRepository userProfileRepository;

    public OnboardingDeliveryService(JobScrapeService jobScrapeService,
                                     JobMatchingService jobMatchingService,
                                     JobListingRepository jobListingRepository,
                                     UserProfileRepository userProfileRepository) {
        this.jobScrapeService      = jobScrapeService;
        this.jobMatchingService    = jobMatchingService;
        this.jobListingRepository  = jobListingRepository;
        this.userProfileRepository = userProfileRepository;
    }

    @Transactional
    public OnboardingDeliveryProgress deliverForUser(String userId) {
        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("Profile not found: " + userId));

        int maxAgeDays = profile.getMaxAgeDays() != null && profile.getMaxAgeDays() > 0
                ? profile.getMaxAgeDays()
                : DEFAULT_MAX_AGE_DAYS;

        String keyword  = buildKeyword(profile);
        String location = profile.getLocation() != null ? profile.getLocation() : "Ireland";

        log.info("Onboarding delivery for user={} keyword='{}' location='{}' maxAgeDays={}",
                userId, keyword, location, maxAgeDays);

        // 1 – scrape all sources in parallel
        List<JobListing> scraped = jobScrapeService.scrapeAll(keyword, location, maxAgeDays);

        // 2 – AI match & score
        List<JobListing> matched = jobMatchingService.matchAndScore(scraped, profile);

        // 3 – filter by user's minMatchPercent
        int minPct = profile.getMinMatchPercent() != null ? profile.getMinMatchPercent() : 0;
        List<JobListing> filtered = matched.stream()
                .filter(j -> j.getMatchScore() == null || j.getMatchScore() >= minPct)
                .collect(Collectors.toList());

        // 4 – persist
        jobListingRepository.saveAll(filtered);

        log.info("Onboarding delivery complete for user={}: {} jobs saved", userId, filtered.size());

        OnboardingDeliveryProgress progress = new OnboardingDeliveryProgress();
        progress.setTotalFetched(scraped.size());
        progress.setTotalMatched(filtered.size());
        progress.setSourceNames(jobScrapeService.getEnabledSourceNames());
        return progress;
    }

    private String buildKeyword(UserProfile profile) {
        if (profile.getDesiredRoles() != null && !profile.getDesiredRoles().isEmpty()) {
            return String.join(" OR ", profile.getDesiredRoles());
        }
        if (profile.getTopSkills() != null && !profile.getTopSkills().isEmpty()) {
            return String.join(" ", profile.getTopSkills());
        }
        return "software engineer";
    }
}
