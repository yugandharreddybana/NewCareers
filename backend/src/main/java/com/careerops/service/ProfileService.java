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

    // ── GET ─────────────────────────────────────────────────────────────────

    public ProfileResponse get(UUID userId) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
        String cvName = cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(UserCv::getFileName).orElse(null);
        return toResponse(p, cvName);
    }

    // ── UPSERT (preferences + goal fields) ───────────────────────────────────

    @Transactional
    public ProfileResponse upsert(UUID userId, ProfileRequest req) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseGet(() -> UserProfile.builder().userId(userId).build());

        // Preference fields
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

        // Section 10 — Career goal fields
        if (req.goalTitle()      != null) p.setGoalTitle(req.goalTitle());
        if (req.goalSalaryMin()  != null) p.setGoalSalaryMin(req.goalSalaryMin());
        if (req.goalSalaryMax()  != null) p.setGoalSalaryMax(req.goalSalaryMax());
        if (req.goalLocation()   != null) p.setGoalLocation(req.goalLocation());
        if (req.openToRemote()   != null) p.setOpenToRemote(req.openToRemote());

        profiles.save(p);
        return get(userId);
    }

    // ── PORTFOLIO CRUD ──────────────────────────────────────────────────────

    /** Add or update a portfolio project in the JSONB array. */
    @Transactional
    public ProfileResponse upsertPortfolioItem(UUID userId, PortfolioItemRequest req) {
        UserProfile p = loadOrCreate(userId);

        List<Map<String, Object>> items = mutableCopy(p.getPortfolioItems());

        if (req.id() != null) {
            // Update existing item by id
            boolean found = false;
            for (int i = 0; i < items.size(); i++) {
                if (req.id().equals(items.get(i).get("id"))) {
                    items.set(i, toItemMap(req.id(), req));
                    found = true;
                    break;
                }
            }
            if (!found) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        } else {
            // Add new item with generated UUID
            items.add(toItemMap(UUID.randomUUID().toString(), req));
        }

        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    /** Delete a portfolio project by id. */
    @Transactional
    public ProfileResponse deletePortfolioItem(UUID userId, String itemId) {
        UserProfile p = loadOrCreate(userId);
        List<Map<String, Object>> items = mutableCopy(p.getPortfolioItems());
        boolean removed = items.removeIf(m -> itemId.equals(m.get("id")));
        if (!removed) throw new ApiException(HttpStatus.NOT_FOUND, "Portfolio item not found");
        p.setPortfolioItems(items);
        profiles.save(p);
        return get(userId);
    }

    // ── STATS ────────────────────────────────────────────────────────────────

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

    // ── Helpers ─────────────────────────────────────────────────────────────

    private UserProfile loadOrCreate(UUID userId) {
        return profiles.findByUserId(userId)
            .orElseGet(() -> UserProfile.builder().userId(userId).build());
    }

    private static Map<String, Object> toItemMap(String id, PortfolioItemRequest req) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",          id);
        m.put("title",       req.title()       != null ? req.title()       : "");
        m.put("url",         req.url()         != null ? req.url()         : "");
        m.put("description", req.description() != null ? req.description() : "");
        m.put("techTags",    req.techTags()    != null ? req.techTags()    : List.of());
        return m;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> mutableCopy(List<Map<String, Object>> src) {
        if (src == null) return new ArrayList<>();
        return new ArrayList<>(src.stream().map(LinkedHashMap::new).toList());
    }

    private ProfileResponse toResponse(UserProfile p, String cvName) {
        return new ProfileResponse(
            p.getTargetRoles(), p.getTechStack(), p.getLocation(),
            p.getSalaryMin(), p.getSalaryMax(), p.getSectors(),
            p.getFreshnessHours(), p.getMinMatchPercent(),
            p.getSponsorshipRequired(), p.getOnboarded(),
            cvName,
            p.getGoalTitle(), p.getGoalSalaryMin(), p.getGoalSalaryMax(),
            p.getGoalLocation(), p.getOpenToRemote(),
            p.getPortfolioItems() != null ? p.getPortfolioItems() : List.of(),
            ProfileValidator.score(p, cvName)
        );
    }
}
