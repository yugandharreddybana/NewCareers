package com.careerops.service;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.model.UserProfile;
import com.careerops.model.UserProfile.PortfolioItem;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Task 125 (Section 11 fix) — AuditLogService injected.
 * Audit events emitted on: upsert (PROFILE_UPDATE / ONBOARDING_COMPLETE),
 * addPortfolioItem / updatePortfolioItem / deletePortfolioItem (PORTFOLIO_CHANGE).
 *
 * All Section 10 method signatures are preserved exactly:
 *   get(UUID)
 *   upsert(UUID, ProfileRequest)  → ProfileResponse
 *   stats(UUID)                   → StatsResponse
 *   addPortfolioItem(UUID, PortfolioItemRequest)          → ProfileResponse
 *   updatePortfolioItem(UUID, String, PortfolioItemRequest) → ProfileResponse
 *   deletePortfolioItem(UUID, String)                     → ProfileResponse
 *
 * CV operations remain in CvService (separate bean); ProfileService does NOT
 * duplicate them.
 */
@Service
public class ProfileService {

    private static final Logger log = LoggerFactory.getLogger(ProfileService.class);

    private final UserProfileRepository profiles;
    private final UserCvRepository      cvs;
    private final UserJobRepository     userJobs;
    private final AuditLogService       audit; // Task 125

    public ProfileService(UserProfileRepository profiles,
                          UserCvRepository cvs,
                          UserJobRepository userJobs,
                          AuditLogService audit) {
        this.profiles = profiles;
        this.cvs      = cvs;
        this.userJobs = userJobs;
        this.audit    = audit;
    }

    // ─── Get profile ───────────────────────────────────────────────────────────

    public ProfileResponse get(UUID userId) {
        var profile = requireProfile(userId);
        String activeCvFileName = cvs
            .findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(UserCv::getFileName).orElse(null);
        return toResponse(profile, activeCvFileName);
    }

    // ─── Upsert profile ────────────────────────────────────────────────────────

    @Transactional
    public ProfileResponse upsert(UUID userId, ProfileRequest req) {
        var profile = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));

        if (req.targetRoles()        != null) profile.setTargetRoles(req.targetRoles());
        if (req.techStack()          != null) profile.setTechStack(req.techStack());
        if (req.location()           != null) profile.setLocation(req.location());
        if (req.salaryMin()          != null) profile.setSalaryMin(req.salaryMin());
        if (req.salaryMax()          != null) profile.setSalaryMax(req.salaryMax());
        if (req.sectors()            != null) profile.setSectors(req.sectors());
        if (req.freshnessHours()     != null) profile.setFreshnessHours(req.freshnessHours());
        if (req.minMatchPercent()    != null) profile.setMinMatchPercent(req.minMatchPercent());
        if (req.sponsorshipRequired()!= null) profile.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.goalTitle()          != null) profile.setGoalTitle(req.goalTitle());
        if (req.goalSalaryMin()      != null) profile.setGoalSalaryMin(req.goalSalaryMin());
        if (req.goalSalaryMax()      != null) profile.setGoalSalaryMax(req.goalSalaryMax());
        if (req.goalLocation()       != null) profile.setGoalLocation(req.goalLocation());
        if (req.openToRemote()       != null) profile.setOpenToRemote(req.openToRemote());

        boolean completingOnboarding = Boolean.TRUE.equals(req.onboarded())
                && !Boolean.TRUE.equals(profile.getOnboarded());
        if (completingOnboarding) profile.setOnboarded(true);

        profiles.save(profile);

        // Task 125 — audit
        audit.log(userId, "PROFILE_UPDATE", Map.of("action", "upsert"));
        if (completingOnboarding) {
            String role = (req.targetRoles() != null && req.targetRoles().length > 0)
                ? req.targetRoles()[0] : "unset";
            audit.log(userId, "ONBOARDING_COMPLETE", Map.of("targetRole", role));
        }

        String activeCvFileName = cvs
            .findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(UserCv::getFileName).orElse(null);
        return toResponse(profile, activeCvFileName);
    }

    // ─── Stats ─────────────────────────────────────────────────────────────────

    public StatsResponse stats(UUID userId) {
        long total      = userJobs.countByUserId(userId);
        long applied    = userJobs.countByUserIdAndKanbanColumn(userId, "Applied");
        long interviews = userJobs.countByUserIdAndKanbanColumn(userId, "Interview");
        long offers     = userJobs.countByUserIdAndKanbanColumn(userId, "Offer");
        double avgMatch = userJobs.avgMatchPercentForUser(userId);
        return new StatsResponse(total, applied, interviews, offers, avgMatch);
    }

    // ─── Portfolio CRUD ────────────────────────────────────────────────────────

    @Transactional
    public ProfileResponse addPortfolioItem(UUID userId, PortfolioItemRequest req) {
        var profile = requireProfile(userId);
        List<PortfolioItem> items = ensureList(profile);
        items.add(PortfolioItem.builder()
            .id(UUID.randomUUID().toString())
            .title(req.title())
            .url(req.url())
            .description(req.description())
            .techTags(req.techTags())
            .build());
        profile.setPortfolioItems(items);
        profiles.save(profile);
        audit.log(userId, "PORTFOLIO_CHANGE", Map.of("action", "add", "title",
            req.title() != null ? req.title() : ""));
        return get(userId);
    }

    @Transactional
    public ProfileResponse updatePortfolioItem(UUID userId, String itemId,
                                               PortfolioItemRequest req) {
        var profile = requireProfile(userId);
        List<PortfolioItem> items = ensureList(profile);
        boolean found = false;
        for (PortfolioItem item : items) {
            if (itemId.equals(item.getId())) {
                if (req.title()       != null) item.setTitle(req.title());
                if (req.url()         != null) item.setUrl(req.url());
                if (req.description() != null) item.setDescription(req.description());
                if (req.techTags()    != null) item.setTechTags(req.techTags());
                found = true;
                break;
            }
        }
        if (!found) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        profile.setPortfolioItems(items);
        profiles.save(profile);
        audit.log(userId, "PORTFOLIO_CHANGE", Map.of("action", "update", "itemId", itemId));
        return get(userId);
    }

    @Transactional
    public ProfileResponse deletePortfolioItem(UUID userId, String itemId) {
        var profile = requireProfile(userId);
        List<PortfolioItem> items = ensureList(profile);
        boolean removed = items.removeIf(i -> itemId.equals(i.getId()));
        if (!removed) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        profile.setPortfolioItems(items);
        profiles.save(profile);
        audit.log(userId, "PORTFOLIO_CHANGE", Map.of("action", "delete", "itemId", itemId));
        return get(userId);
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    private UserProfile requireProfile(UUID userId) {
        return profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
    }

    private List<PortfolioItem> ensureList(UserProfile profile) {
        return profile.getPortfolioItems() != null
            ? new ArrayList<>(profile.getPortfolioItems())
            : new ArrayList<>();
    }

    private ProfileResponse toResponse(UserProfile p, String activeCvFileName) {
        int score = computeCompleteness(p);
        return new ProfileResponse(
            p.getTargetRoles(), p.getTechStack(), p.getLocation(),
            p.getSalaryMin(), p.getSalaryMax(), p.getSectors(),
            p.getFreshnessHours(), p.getMinMatchPercent(),
            p.getSponsorshipRequired(), p.getOnboarded(),
            activeCvFileName,
            p.getPortfolioItems(),
            p.getGoalTitle(), p.getGoalSalaryMin(), p.getGoalSalaryMax(),
            p.getGoalLocation(), p.getOpenToRemote(),
            score
        );
    }

    /**
     * Simple completeness score (0–100) based on how many key fields are filled.
     * Each filled field = 10 points; capped at 100.
     */
    private int computeCompleteness(UserProfile p) {
        int score = 0;
        if (p.getTargetRoles()    != null && p.getTargetRoles().length    > 0) score += 10;
        if (p.getTechStack()      != null && p.getTechStack().length      > 0) score += 10;
        if (p.getLocation()       != null && !p.getLocation().isBlank())       score += 10;
        if (p.getSalaryMin()      != null)                                      score += 10;
        if (p.getSalaryMax()      != null)                                      score += 10;
        if (p.getSectors()        != null && p.getSectors().length        > 0) score += 10;
        if (p.getGoalTitle()      != null && !p.getGoalTitle().isBlank())      score += 10;
        if (p.getGoalLocation()   != null && !p.getGoalLocation().isBlank())   score += 10;
        if (p.getOpenToRemote()   != null)                                      score += 10;
        if (p.getSponsorshipRequired() != null)                                 score += 10;
        return Math.min(score, 100);
    }
}
