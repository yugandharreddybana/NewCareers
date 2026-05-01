package com.careerops.service;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.util.ProfileValidator;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Section 10 Task 106 — portfolio CRUD + goal fields + completeness score.
 */
@Service
public class ProfileService {

    private final UserProfileRepository profiles;
    private final UserCvRepository      cvs;
    private final UserJobRepository     userJobs;

    public ProfileService(UserProfileRepository p, UserCvRepository c, UserJobRepository uj) {
        this.profiles  = p;
        this.cvs       = c;
        this.userJobs  = uj;
    }

    // ── GET ───────────────────────────────────────────────────────────────

    public ProfileResponse get(UUID userId) {
        UserProfile p = find(userId);
        String cvName = cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
                           .map(UserCv::getFileName).orElse(null);
        return toResponse(p, cvName);
    }

    // ── UPSERT (preferences + goals) ──────────────────────────────────────

    @Transactional
    public ProfileResponse upsert(UUID userId, ProfileRequest req) {
        UserProfile p = profiles.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder().userId(userId).build());

        if (req.targetRoles()        != null) p.setTargetRoles(req.targetRoles());
        if (req.techStack()          != null) p.setTechStack(req.techStack());
        if (req.location()           != null) p.setLocation(req.location());
        if (req.salaryMin()          != null) p.setSalaryMin(req.salaryMin());
        if (req.salaryMax()          != null) p.setSalaryMax(req.salaryMax());
        if (req.sectors()            != null) p.setSectors(req.sectors());
        if (req.freshnessHours()     != null) p.setFreshnessHours(req.freshnessHours());
        if (req.minMatchPercent()    != null) p.setMinMatchPercent(req.minMatchPercent());
        if (req.sponsorshipRequired()!= null) p.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.onboarded()          != null) p.setOnboarded(req.onboarded());
        // Goal fields
        if (req.goalTitle()          != null) p.setGoalTitle(req.goalTitle());
        if (req.goalSalaryMin()      != null) p.setGoalSalaryMin(req.goalSalaryMin());
        if (req.goalSalaryMax()      != null) p.setGoalSalaryMax(req.goalSalaryMax());
        if (req.goalLocation()       != null) p.setGoalLocation(req.goalLocation());
        if (req.openToRemote()       != null) p.setOpenToRemote(req.openToRemote());

        profiles.save(p);
        return get(userId);
    }

    // ── PORTFOLIO CRUD ────────────────────────────────────────────────────

    @Transactional
    public ProfileResponse addPortfolioItem(UUID userId, PortfolioItemRequest req) {
        UserProfile p = find(userId);
        List<Map<String, Object>> items = mutablePortfolio(p);

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id",          UUID.randomUUID().toString());
        item.put("title",       req.title());
        item.put("url",         req.url());
        item.put("description", req.description());
        item.put("techTags",    req.techTags() != null ? req.techTags() : List.of());
        items.add(item);

        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    @Transactional
    public ProfileResponse updatePortfolioItem(UUID userId, PortfolioItemRequest req) {
        if (req.id() == null) throw new ApiException(HttpStatus.BAD_REQUEST, "id is required for update");
        UserProfile p = find(userId);
        List<Map<String, Object>> items = mutablePortfolio(p);

        boolean found = false;
        for (Map<String, Object> item : items) {
            if (req.id().equals(item.get("id"))) {
                if (req.title()       != null) item.put("title",       req.title());
                if (req.url()         != null) item.put("url",         req.url());
                if (req.description() != null) item.put("description", req.description());
                if (req.techTags()    != null) item.put("techTags",    req.techTags());
                found = true;
                break;
            }
        }
        if (!found) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");

        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    @Transactional
    public ProfileResponse deletePortfolioItem(UUID userId, String itemId) {
        UserProfile p = find(userId);
        List<Map<String, Object>> items = mutablePortfolio(p);
        boolean removed = items.removeIf(i -> itemId.equals(i.get("id")));
        if (!removed) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    // ── STATS ─────────────────────────────────────────────────────────────

    public StatsResponse stats(UUID userId) {
        List<UserJob> all = userJobs.findByUserIdOrderByDeliveredAtDesc(userId);
        long total      = all.size();
        long applied    = all.stream().filter(j -> "Applied".equals(j.getKanbanColumn())).count();
        long interviews = all.stream().filter(j -> "Interview".equals(j.getKanbanColumn())).count();
        long offers     = all.stream().filter(j -> "Offer".equals(j.getKanbanColumn())).count();
        double avg      = all.stream().filter(j -> j.getMatchPercent() != null)
                             .mapToInt(UserJob::getMatchPercent).average().orElse(0);
        return new StatsResponse(total, applied, interviews, offers, Math.round(avg * 10.0) / 10.0);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private UserProfile find(UUID userId) {
        return profiles.findByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mutablePortfolio(UserProfile p) {
        List<Map<String, Object>> existing = p.getPortfolioItems();
        return existing == null ? new ArrayList<>() : new ArrayList<>(existing);
    }

    private ProfileResponse toResponse(UserProfile p, String cvName) {
        int score = ProfileValidator.completenessScore(p, cvName != null);
        return new ProfileResponse(
            p.getTargetRoles(), p.getTechStack(), p.getLocation(),
            p.getSalaryMin(), p.getSalaryMax(), p.getSectors(),
            p.getFreshnessHours(), p.getMinMatchPercent(),
            p.getSponsorshipRequired(), p.getOnboarded(),
            cvName,
            p.getPortfolioItems() != null ? p.getPortfolioItems() : List.of(),
            p.getGoalTitle(), p.getGoalSalaryMin(), p.getGoalSalaryMax(),
            p.getGoalLocation(), p.getOpenToRemote(),
            score
        );
    }
}
