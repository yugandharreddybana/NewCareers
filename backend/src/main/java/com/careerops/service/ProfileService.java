package com.careerops.service;

import org.jspecify.annotations.Nullable;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.model.UserProfile;
import com.careerops.model.UserProfile.PortfolioItem;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
    private final UserRepository        users;
    private final AuditLogService       audit; // Task 125

    public ProfileService(UserProfileRepository profiles,
                          UserCvRepository cvs,
                          UserJobRepository userJobs,
                          UserRepository users,
                          AuditLogService audit) {
        this.profiles = profiles;
        this.cvs      = cvs;
        this.userJobs = userJobs;
        this.users    = users;
        this.audit    = audit;
    }

    // ─── Get profile ───────────────────────────────────────────────────────────

    public ProfileResponse get(UUID userId) {
        var profile = requireProfile(userId);
        return toResponse(profile, activeCv(userId).orElse(null));
    }

    // ─── Upsert profile ────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    @CacheEvict(value = "user-profile", key = "#userId")
    public ProfileResponse upsert(UUID userId, ProfileRequest req, @Nullable Long ifMatch) {
        var profile = requireProfile(userId);
        if (profile.getVersion() == null) {
            profile.setVersion(0L);
        }
        validateVersion(profile, ifMatch);

        // 3.037 — Validate salary ranges (min <= max)
        Integer min = req.salaryMin() != null ? req.salaryMin() : profile.getSalaryMin();
        Integer max = req.salaryMax() != null ? req.salaryMax() : profile.getSalaryMax();
        if (min != null && max != null && min > max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Salary minimum (" + min + ") cannot be greater than maximum (" + max + ")");
        }

        Integer gMin = req.goalSalaryMin() != null ? req.goalSalaryMin() : profile.getGoalSalaryMin();
        Integer gMax = req.goalSalaryMax() != null ? req.goalSalaryMax() : profile.getGoalSalaryMax();
        if (gMin != null && gMax != null && gMin > gMax) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Goal salary minimum (" + gMin + ") cannot be greater than maximum (" + gMax + ")");
        }

        if (req.name() != null && !req.name().isBlank()) {
            var user = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
            user.setName(req.name().trim());
            users.save(user);
        }

        if (req.targetRoles()        != null) profile.setTargetRoles(req.targetRoles());
        if (req.techStack()          != null) profile.setTechStack(req.techStack());
        if (req.location()           != null) profile.setLocation(req.location());
        if (req.salaryMin()          != null) profile.setSalaryMin(req.salaryMin());
        if (req.salaryMax()          != null) profile.setSalaryMax(req.salaryMax());
        if (req.salaryCurrency()     != null) profile.setSalaryCurrency(req.salaryCurrency());
        if (req.sectors()            != null) profile.setSectors(req.sectors());
        if (req.freshnessHours()     != null) profile.setFreshnessHours(req.freshnessHours());
        if (req.minMatchPercent()    != null) profile.setMinMatchPercent(req.minMatchPercent());
        if (req.sponsorshipRequired()!= null) profile.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.goalTitle()          != null) profile.setGoalTitle(req.goalTitle());
        if (req.goalSalaryMin()      != null) profile.setGoalSalaryMin(req.goalSalaryMin());
        if (req.goalSalaryMax()      != null) profile.setGoalSalaryMax(req.goalSalaryMax());
        if (req.goalLocation()       != null) profile.setGoalLocation(req.goalLocation());
        if (req.openToRemote()       != null) profile.setOpenToRemote(req.openToRemote());
        if (req.experienceLevel() != null) {
            String level = req.experienceLevel().trim();
            if (!level.matches("junior|mid|senior|lead")) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                    "experienceLevel must be one of: junior, mid, senior, lead");
            }
            profile.setExperienceLevel(level);
        }
        if (req.workExperience()     != null) profile.setWorkExperience(new ArrayList<>(req.workExperience()));
        if (req.education()          != null) profile.setEducation(new ArrayList<>(req.education()));
        if (req.remotePolicy()       != null) profile.setRemotePolicy(req.remotePolicy());
        if (req.hybridOnsiteDays()   != null) profile.setHybridOnsiteDays(req.hybridOnsiteDays());
        if (req.availability()       != null) profile.setAvailability(req.availability());

        boolean wasOnboarded = Boolean.TRUE.equals(profile.getOnboarded());
        if (Boolean.TRUE.equals(req.onboarded())) {
            profile.setOnboarded(true);
        }
        boolean completingOnboarding = Boolean.TRUE.equals(req.onboarded()) && !wasOnboarded;
        profiles.save(profile);

        // Task 125 — audit
        audit.log(userId, "PROFILE_UPDATE", Map.of("action", "upsert"));
        if (completingOnboarding) {
            String role = (req.targetRoles() != null && req.targetRoles().length > 0)
                ? req.targetRoles()[0] : "unset";
            audit.log(userId, "ONBOARDING_COMPLETE", Map.of("targetRole", role));
        }

        return toResponse(profile, activeCv(userId).orElse(null));
    }

    // ─── Stats ─────────────────────────────────────────────────────────────────

    public StatsResponse stats(UUID userId) {
        long total      = userJobs.countByUserId(userId);
        long applied    = userJobs.countByUserIdAndKanbanColumn(userId, "Applied");
        long interviews = userJobs.countByUserIdAndKanbanColumn(userId, "Interview");
        long offers     = userJobs.countByUserIdAndKanbanColumn(userId, "Offer");
        double avgMatch = userJobs.avgMatchPercentForUser(userId);
        return new StatsResponse(total, applied, interviews, offers, 
                Math.round(avgMatch * 10.0) / 10.0);
    }

    // ─── Portfolio CRUD ────────────────────────────────────────────────────────

    @Transactional(timeout = 10)
    @CacheEvict(value = "user-profile", key = "#userId")
    public ProfileResponse addPortfolioItem(UUID userId, PortfolioItemRequest req, @Nullable Long ifMatch) {
        var profile = requireProfile(userId);
        validateVersion(profile, ifMatch);

        List<PortfolioItem> items = ensureList(profile);

        if (items.size() >= 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Portfolio is limited to a maximum of 20 items");
        }

        if (req.title() != null && req.title().length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Title cannot exceed 100 characters");
        }

        if (req.description() != null && req.description().length() > 1000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Description cannot exceed 1000 characters");
        }

        if (req.url() != null && !req.url().isBlank()) {
            if (!req.url().startsWith("http://") && !req.url().startsWith("https://")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "URL must start with http:// or https://");
            }
        }
        
        // 3.038 — Prevent duplicate URLs in portfolio
        if (req.url() != null && !req.url().isBlank()) {
            if (items.stream().anyMatch(i -> req.url().equalsIgnoreCase(i.getUrl()))) {
                throw new ApiException(HttpStatus.CONFLICT, "This project URL is already in your portfolio");
            }
        }

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

    @Transactional(timeout = 10)
    @CacheEvict(value = "user-profile", key = "#userId")
    public ProfileResponse updatePortfolioItem(UUID userId, String itemId,
                                               PortfolioItemRequest req, @Nullable Long ifMatch) {
        var profile = requireProfile(userId);
        validateVersion(profile, ifMatch);

        List<PortfolioItem> items = ensureList(profile);

        if (req.title() != null && req.title().length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Title cannot exceed 100 characters");
        }

        if (req.description() != null && req.description().length() > 1000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Description cannot exceed 1000 characters");
        }

        if (req.url() != null && !req.url().isBlank()) {
            if (!req.url().startsWith("http://") && !req.url().startsWith("https://")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "URL must start with http:// or https://");
            }
        }

        // 3.038 — Ensure URL uniqueness on update
        if (req.url() != null && !req.url().isBlank()) {
            if (items.stream().anyMatch(i -> !itemId.equals(i.getId()) && req.url().equalsIgnoreCase(i.getUrl()))) {
                throw new ApiException(HttpStatus.CONFLICT, "This project URL is already in your portfolio");
            }
        }

        boolean found = false;
        for (PortfolioItem item : items) {
            if (itemId.equals(item.getId())) {
                // 3.039 — Protect integrity: don't allow nulling out required fields
                if (req.title()       != null && !req.title().isBlank()) item.setTitle(req.title());
                if (req.url()         != null && !req.url().isBlank())   item.setUrl(req.url());
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

    @Transactional(timeout = 10)
    @CacheEvict(value = "user-profile", key = "#userId")
    public ProfileResponse deletePortfolioItem(UUID userId, String itemId, @Nullable Long ifMatch) {
        var profile = requireProfile(userId);
        validateVersion(profile, ifMatch);

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
            .orElseGet(() -> {
                UserProfile p = UserProfile.builder()
                        .userId(userId)
                        .location("Unknown")
                        .freshnessHours(96)
                        .minMatchPercent(UserProfile.DEFAULT_MIN_MATCH_PERCENT)
                        .sponsorshipRequired(false)
                        .onboarded(false)
                        .version(0L)
                        .build();
                return profiles.save(p);
            });
    }

    private void validateVersion(UserProfile profile, @Nullable Long ifMatch) {
        if (ifMatch != null && !ifMatch.equals(profile.getVersion())) {
            throw new ApiException(HttpStatus.PRECONDITION_FAILED,
                "Profile was modified by another session. Please refresh and try again.");
        }
    }

    private List<PortfolioItem> ensureList(UserProfile profile) {
        return profile.getPortfolioItems() != null
            ? new ArrayList<>(profile.getPortfolioItems())
            : new ArrayList<>();
    }

    private Optional<UserCv> activeCv(UUID userId) {
        return cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId);
    }

    private ProfileResponse toResponse(UserProfile p, @Nullable UserCv activeCv) {
        int score = computeCompleteness(p);
        String activeCvFileName = activeCv != null ? activeCv.getFileName() : null;
        String activeCvId = activeCv != null && activeCv.getId() != null
            ? activeCv.getId().toString()
            : null;
        return new ProfileResponse(
            p.getTargetRoles(), p.getTechStack(), p.getLocation(),
            p.getSalaryMin(), p.getSalaryMax(), p.getSalaryCurrency(), p.getSectors(),
            p.getFreshnessHours(), p.getMinMatchPercent(),
            p.getSponsorshipRequired(), p.getOnboarded(),
            activeCvFileName,
            activeCvId,
            p.getPortfolioItems(),
            p.getGoalTitle(), p.getGoalSalaryMin(), p.getGoalSalaryMax(),
            p.getGoalLocation(), p.getOpenToRemote(),
            p.getExperienceLevel(),
            p.getWorkExperience() != null ? p.getWorkExperience() : List.of(),
            p.getEducation() != null ? p.getEducation() : List.of(),
            p.getRemotePolicy(), p.getHybridOnsiteDays(), p.getAvailability(),
            score,
            p.getVersion()
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
