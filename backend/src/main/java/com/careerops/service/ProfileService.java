package com.careerops.service;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserCv;
import com.careerops.model.UserProfile;
import com.careerops.repository.UserCvRepository;
import com.careerops.repository.UserProfileRepository;
import com.careerops.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/**
 * Task 125 — AuditLogService injected; key profile mutations now emit
 * structured audit events (PROFILE_UPDATE, CV_UPLOAD, ONBOARDING_COMPLETE).
 * All existing business logic is unchanged.
 */
@Service
public class ProfileService {

    private static final Logger log = LoggerFactory.getLogger(ProfileService.class);

    private final UserProfileRepository profiles;
    private final UserRepository        users;
    private final UserCvRepository      cvs;
    private final SupabaseStorageService storage;
    private final CvParserService       parser;
    private final AuditLogService       audit; // Task 125

    public ProfileService(UserProfileRepository profiles,
                          UserRepository users,
                          UserCvRepository cvs,
                          SupabaseStorageService storage,
                          CvParserService parser,
                          AuditLogService audit) {
        this.profiles = profiles;
        this.users    = users;
        this.cvs      = cvs;
        this.storage  = storage;
        this.parser   = parser;
        this.audit    = audit;
    }

    // ─── Get profile ───────────────────────────────────────────────────────────

    public ProfileResponse get(UUID userId) {
        var user    = users.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        var profile = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
        var cv      = cvs.findTopByUserIdOrderByCreatedAtDesc(userId).orElse(null);
        return ProfileResponse.from(user, profile, cv);
    }

    // ─── Update profile ────────────────────────────────────────────────────────

    @Transactional
    public ProfileResponse update(UUID userId, UpdateProfileRequest req,
                                   HttpServletRequest httpRequest) {
        var profile = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));

        if (req.location()           != null) profile.setLocation(req.location());
        if (req.targetRole()         != null) profile.setTargetRole(req.targetRole());
        if (req.skills()             != null) profile.setSkills(req.skills());
        if (req.experienceLevel()    != null) profile.setExperienceLevel(req.experienceLevel());
        if (req.desiredSalaryMin()   != null) profile.setDesiredSalaryMin(req.desiredSalaryMin());
        if (req.sponsorshipRequired()!= null) profile.setSponsorshipRequired(req.sponsorshipRequired());
        if (req.freshnessHours()     != null) profile.setFreshnessHours(req.freshnessHours());
        if (req.minMatchPercent()    != null) profile.setMinMatchPercent(req.minMatchPercent());

        boolean completingOnboarding = Boolean.TRUE.equals(req.onboardingCompleted())
                && !Boolean.TRUE.equals(profile.getOnboarded());
        if (completingOnboarding) profile.setOnboarded(true);

        profiles.save(profile);

        // Task 125 — audit profile mutations
        audit.log(userId, "PROFILE_UPDATE", httpRequest);
        if (completingOnboarding) {
            audit.log(userId, "ONBOARDING_COMPLETE", Map.of("targetRole",
                req.targetRole() != null ? req.targetRole() : "unset"));
        }

        var user = users.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
        var cv   = cvs.findTopByUserIdOrderByCreatedAtDesc(userId).orElse(null);
        return ProfileResponse.from(user, profile, cv);
    }

    /** Overload without HttpServletRequest (e.g. internal callers). */
    @Transactional
    public ProfileResponse update(UUID userId, UpdateProfileRequest req) {
        return update(userId, req, null);
    }

    // ─── CV upload ─────────────────────────────────────────────────────────────

    @Transactional
    public CvUploadResponse uploadCv(UUID userId, MultipartFile file,
                                      HttpServletRequest httpRequest) {
        if (file.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "File is empty");

        String url = storage.upload("user-cvs",
            userId + "/" + System.currentTimeMillis() + "-" + file.getOriginalFilename(), file);

        String extractedText = null;
        try {
            extractedText = parser.extractText(file);
        } catch (Exception e) {
            log.warn("CV text extraction failed for user {}: {}", userId, e.getMessage());
        }

        UserCv cv = UserCv.builder()
            .userId(userId)
            .fileUrl(url)
            .fileName(file.getOriginalFilename())
            .fileSizeBytes(file.getSize())
            .extractedText(extractedText)
            .build();
        cvs.save(cv);

        var profile = profiles.findByUserId(userId).orElse(null);
        if (profile != null) {
            profile.setCvUrl(url);
            profiles.save(profile);
        }

        // Task 125 — audit CV upload
        audit.log(userId, "CV_UPLOAD", Map.of("fileName",
            file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown"));

        return new CvUploadResponse(url, cv.getId().toString());
    }

    /** Overload without HttpServletRequest. */
    @Transactional
    public CvUploadResponse uploadCv(UUID userId, MultipartFile file) {
        return uploadCv(userId, file, null);
    }

    // ─── CV download URL ───────────────────────────────────────────────────────

    public CvDownloadResponse getDownloadUrl(UUID userId) {
        var cv = cvs.findTopByUserIdOrderByCreatedAtDesc(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "No CV found"));
        String signed = storage.signedUrl("user-cvs", userId + "/" + cv.getFileName(), 900);
        return new CvDownloadResponse(signed);
    }

    // ─── Stats ─────────────────────────────────────────────────────────────────

    public ProfileStatsResponse stats(UUID userId) {
        var profile = profiles.findByUserId(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Profile not found"));
        return ProfileStatsResponse.from(profile);
    }
}
