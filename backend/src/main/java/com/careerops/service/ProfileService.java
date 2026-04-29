package com.careerops.service;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.model.UserJob;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserJobRepository;
import com.careerops.repository.UserProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ProfileService {

    private final UserProfileRepository profiles;
    private final UserCvRepository cvs;
    private final UserJobRepository userJobs;

    public ProfileService(UserProfileRepository p, UserCvRepository c, UserJobRepository uj) {
        this.profiles = p; this.cvs = c; this.userJobs = uj;
    }

    public ProfileResponse get(UUID userId) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
        String cvName = cvs.findFirstByUserIdAndIsActiveTrueOrderByUploadedAtDesc(userId)
            .map(UserCv::getFileName).orElse(null);
        return new ProfileResponse(
            p.getTargetRoles(), p.getTechStack(), p.getLocation(),
            p.getSalaryMin(), p.getSalaryMax(), p.getSectors(),
            p.getFreshnessHours(), p.getMinMatchPercent(),
            p.getSponsorshipRequired(), p.getOnboarded(), cvName
        );
    }

    @Transactional
    public ProfileResponse upsert(UUID userId, ProfileRequest req) {
        UserProfile p = profiles.findByUserId(userId)
            .orElseGet(() -> UserProfile.builder().userId(userId).build());
        if (req.targetRoles() != null) p.setTargetRoles(req.targetRoles());
        if (req.techStack() != null)   p.setTechStack(req.techStack());
        if (req.location() != null)    p.setLocation(req.location());
        if (req.salaryMin() != null)   p.setSalaryMin(req.salaryMin());
        if (req.salaryMax() != null)   p.setSalaryMax(req.salaryMax());
        if (req.sectors() != null)     p.setSectors(req.sectors());
        if (req.freshnessHours() != null) p.setFreshnessHours(req.freshnessHours());
        if (req.minMatchPercent() != null) p.setMinMatchPercent(req.minMatchPercent());
        if (req.sponsorshipRequired() != null) p.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.onboarded() != null)   p.setOnboarded(req.onboarded());
        profiles.save(p);
        return get(userId);
    }

    public StatsResponse stats(UUID userId) {
        List<UserJob> all = userJobs.findByUserIdOrderByDeliveredAtDesc(userId);
        long total = all.size();
        long applied = all.stream().filter(j -> "Applied".equals(j.getKanbanColumn())).count();
        long interviews = all.stream().filter(j -> "Interview".equals(j.getKanbanColumn())).count();
        long offers = all.stream().filter(j -> "Offer".equals(j.getKanbanColumn())).count();
        double avg = all.stream().filter(j -> j.getMatchPercent() != null)
            .mapToInt(UserJob::getMatchPercent).average().orElse(0);
        return new StatsResponse(total, applied, interviews, offers, Math.round(avg * 10.0) / 10.0);
    }
}
