package com.careerops.service;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.model.UserProfile.PortfolioItem;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ProfileService {

    private final UserProfileRepository profiles;
    private final UserCvRepository      cvs;
    private final UserJobRepository     userJobs;

    public ProfileService(UserProfileRepository p, UserCvRepository c, UserJobRepository uj) {
        this.profiles = p;
        this.cvs      = c;
        this.userJobs = uj;
    }

    // ── GET profile ──────────────────────────────────────────────────────────

    public ProfileResponse get(UUID userId) {
        UserProfile p = require(userId);
        String cvName = cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
                .map(UserCv::getFileName).orElse(null);
        return toResponse(p, cvName);
    }

    // ── UPSERT (preferences + goals) ─────────────────────────────────────────

    @Transactional
    public ProfileResponse upsert(UUID userId, ProfileRequest req) {
        UserProfile p = profiles.findByUserId(userId)
                .orElseGet(() -> UserProfile.builder().userId(userId).build());

        if (req.targetRoles()         != null) p.setTargetRoles(req.targetRoles());
        if (req.techStack()           != null) p.setTechStack(req.techStack());
        if (req.location()            != null) p.setLocation(req.location());
        if (req.salaryMin()           != null) p.setSalaryMin(req.salaryMin());
        if (req.salaryMax()           != null) p.setSalaryMax(req.salaryMax());
        if (req.sectors()             != null) p.setSectors(req.sectors());
        if (req.freshnessHours()      != null) p.setFreshnessHours(req.freshnessHours());
        if (req.minMatchPercent()     != null) p.setMinMatchPercent(req.minMatchPercent());
        if (req.sponsorshipRequired() != null) p.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.onboarded()           != null) p.setOnboarded(req.onboarded());
        // Section 10 — career goals
        if (req.goalTitle()           != null) p.setGoalTitle(req.goalTitle());
        if (req.goalSalaryMin()       != null) p.setGoalSalaryMin(req.goalSalaryMin());
        if (req.goalSalaryMax()       != null) p.setGoalSalaryMax(req.goalSalaryMax());
        if (req.goalLocation()        != null) p.setGoalLocation(req.goalLocation());
        if (req.openToRemote()        != null) p.setOpenToRemote(req.openToRemote());

        profiles.save(p);
        return get(userId);
    }

    // ── Portfolio: ADD item ───────────────────────────────────────────────────

    @Transactional
    public ProfileResponse addPortfolioItem(UUID userId, PortfolioItemRequest req) {
        UserProfile p = require(userId);
        List<PortfolioItem> items = mutableList(p.getPortfolioItems());
        items.add(PortfolioItem.builder()
                .id(UUID.randomUUID().toString())
                .title(req.title())
                .url(req.url())
                .description(req.description())
                .techTags(req.techTags() != null ? req.techTags() : List.of())
                .build());
        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    // ── Portfolio: UPDATE item ────────────────────────────────────────────────

    @Transactional
    public ProfileResponse updatePortfolioItem(UUID userId, String itemId, PortfolioItemRequest req) {
        UserProfile p = require(userId);
        List<PortfolioItem> items = mutableList(p.getPortfolioItems());
        boolean found = false;
        for (int i = 0; i < items.size(); i++) {
            if (itemId.equals(items.get(i).getId())) {
                items.set(i, PortfolioItem.builder()
                        .id(itemId)
                        .title(req.title())
                        .url(req.url())
                        .description(req.description())
                        .techTags(req.techTags() != null ? req.techTags() : List.of())
                        .build());
                found = true;
                break;
            }
        }
        if (!found) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    // ── Portfolio: DELETE item ────────────────────────────────────────────────

    @Transactional
    public ProfileResponse deletePortfolioItem(UUID userId, String itemId) {
        UserProfile p = require(userId);
        List<PortfolioItem> items = mutableList(p.getPortfolioItems());
        boolean removed = items.removeIf(it -> itemId.equals(it.getId()));
        if (!removed) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UserProfile require(UUID userId) {
        return profiles.findByUserId(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
    }

    private List<PortfolioItem> mutableList(List<PortfolioItem> src) {
        return src == null ? new ArrayList<>() : new ArrayList<>(src);
    }

    private ProfileResponse toResponse(UserProfile p, String cvName) {
        return new ProfileResponse(
                p.getTargetRoles(), p.getTechStack(), p.getLocation(),
                p.getSalaryMin(),   p.getSalaryMax(), p.getSectors(),
                p.getFreshnessHours(), p.getMinMatchPercent(),
                p.getSponsorshipRequired(), p.getOnboarded(), cvName,
                p.getPortfolioItems() != null ? p.getPortfolioItems() : List.of(),
                p.getGoalTitle(),     p.getGoalSalaryMin(), p.getGoalSalaryMax(),
                p.getGoalLocation(),  p.getOpenToRemote()
        );
    }
}
