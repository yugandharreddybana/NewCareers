package com.careerops.controller;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.service.CvService;
import com.careerops.service.JobDeliveryService;
import com.careerops.service.LinkedInImportService;
import com.careerops.service.ProfileService;
import com.careerops.util.AuthUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Section 10 — Task 110
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 *
 * First-time job delivery:
 *   After PUT /profile, if the profile transitions to onboarded=true,
 *   an async background fetch is fired immediately so the user sees jobs
 *   right away without waiting for the 08:00 cron.
 */
@RestController
@RequestMapping("/profile")
@io.micrometer.core.annotation.Timed
public class ProfileController {

    private static final Logger log = LoggerFactory.getLogger(ProfileController.class);

    private final ProfileService          profile;
    private final CvService               cv;
    private final LinkedInImportService   linkedIn;
    private final com.careerops.service.VirusScannerService scanner;
    private final JobDeliveryService      delivery;

    public ProfileController(ProfileService p, CvService c, LinkedInImportService li,
                             com.careerops.service.VirusScannerService s,
                             JobDeliveryService delivery) {
        this.profile  = p;
        this.cv       = c;
        this.linkedIn = li;
        this.scanner  = s;
        this.delivery = delivery;
    }

    // ── Core profile ─────────────────────────────────────────────────────

    @GetMapping
    public ProfileResponse get() {
        return profile.get(AuthUtil.currentUserId());
    }

    /**
     * PUT /profile
     *
     * Saves the profile. If the saved profile is now onboarded=true AND
     * the user had no jobs yet (i.e. this is their first save completing onboarding),
     * fires an async job fetch in the background so jobs appear immediately.
     * The HTTP response returns immediately — the fetch runs in a daemon thread.
     */
    @PutMapping
    public ProfileResponse upsert(
            @RequestHeader(value = "If-Match", required = false) Long ifMatch,
            @jakarta.validation.Valid @RequestBody ProfileRequest req) {
        java.util.UUID userId = AuthUtil.currentUserId();
        boolean wasOnboardedBefore = profile.isOnboarded(userId);
        ProfileResponse saved = profile.upsert(userId, req, ifMatch);

        // Fire first-time job fetch async if this PUT completed onboarding
        if (!wasOnboardedBefore && Boolean.TRUE.equals(saved.onboarded())) {
            CompletableFuture.runAsync(() -> {
                try {
                    log.info("First-time onboarding complete for userId={} — firing immediate job fetch", userId);
                    delivery.deliver(userId, 10);
                    log.info("First-time job fetch complete for userId={}", userId);
                } catch (Exception e) {
                    // Non-fatal — cron will catch up at 08:00
                    log.warn("First-time job fetch failed for userId={}: {}", userId, e.getMessage());
                }
            });
        }

        return saved;
    }

    // ── CV ────────────────────────────────────────────────────────────────

    @PostMapping(value = "/cv", consumes = "multipart/form-data")
    public Map<String, Object> uploadCv(
            @RequestPart("file") MultipartFile file) {
        scanner.scan(file);
        try {
            var cvDoc = cv.upload(AuthUtil.currentUserId(), file);
            return Map.of(
                    "id",         cvDoc.getId().toString(),
                    "fileName",   cvDoc.getFileName(),
                    "uploadedAt", cvDoc.getUploadedAt()
            );
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read uploaded file: " + e.getMessage());
        } catch (org.springframework.web.reactive.function.client.WebClientResponseException e) {
            throw ApiException.internalError("Storage service failure: " + e.getStatusText());
        }
    }

    @GetMapping("/cv/download")
    public Map<String, String> downloadUrl() {
        String url = cv.activeCvDownloadUrl(AuthUtil.currentUserId());
        if (url == null || url.isBlank()) {
            throw ApiException.notFound("No active CV");
        }
        return Map.of("url", url);
    }

    // ── Stats ─────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public StatsResponse stats() {
        return profile.stats(AuthUtil.currentUserId());
    }

    // ── Portfolio ─────────────────────────────────────────────────────────

    @PostMapping("/portfolio")
    public ProfileResponse addPortfolioItem(
            @RequestHeader(value = "If-Match", required = false) Long ifMatch,
            @jakarta.validation.Valid @RequestBody PortfolioItemRequest req) {
        return profile.addPortfolioItem(AuthUtil.currentUserId(), req, ifMatch);
    }

    @PutMapping("/portfolio/{itemId}")
    public ProfileResponse updatePortfolioItem(
            @RequestHeader(value = "If-Match", required = false) Long ifMatch,
            @PathVariable String itemId,
            @jakarta.validation.Valid @RequestBody PortfolioItemRequest req) {
        return profile.updatePortfolioItem(AuthUtil.currentUserId(), itemId, req, ifMatch);
    }

    @DeleteMapping("/portfolio/{itemId}")
    public ProfileResponse deletePortfolioItem(
            @RequestHeader(value = "If-Match", required = false) Long ifMatch,
            @PathVariable String itemId) {
        return profile.deletePortfolioItem(AuthUtil.currentUserId(), itemId, ifMatch);
    }

    // ── LinkedIn Import ───────────────────────────────────────────────────

    @PostMapping(value = "/import/linkedin", consumes = "multipart/form-data")
    public ImportSummary importLinkedIn(
            @RequestPart("file") MultipartFile file) {
        scanner.scan(file);
        try {
            return linkedIn.importZip(AuthUtil.currentUserId(), file);
        } catch (IOException e) {
            throw ApiException.badRequest("Could not read uploaded ZIP: " + e.getMessage());
        } catch (org.springframework.web.reactive.function.client.WebClientResponseException e) {
            throw ApiException.internalError("LinkedIn import failed (storage issue): " + e.getStatusText());
        }
    }
}
