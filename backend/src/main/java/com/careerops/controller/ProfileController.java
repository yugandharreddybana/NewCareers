package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.model.UserProfile;
import com.careerops.service.CvService;
import com.careerops.service.LinkedInImportService;
import com.careerops.service.ProfileService;
import com.careerops.util.AuthUtil;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Section 10 — Task 110
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 *
 * First-time job delivery is started explicitly via POST /onboarding/delivery/start
 * after CV upload (Track A), not from this controller.
 */
@RestController
@RequestMapping("/profile")
@io.micrometer.core.annotation.Timed
public class ProfileController {

    private final ProfileService            profile;
    private final CvService                 cv;
    private final LinkedInImportService     linkedIn;
    private final com.careerops.service.VirusScannerService scanner;

    public ProfileController(ProfileService p, CvService c, LinkedInImportService li,
                             com.careerops.service.VirusScannerService s) {
        this.profile  = p;
        this.cv       = c;
        this.linkedIn = li;
        this.scanner  = s;
    }

    // ── Core profile ─────────────────────────────────────────────────────

    @GetMapping
    public ProfileResponse get() {
        return profile.get(AuthUtil.currentUserId());
    }

    /** PUT /profile — saves profile; onboarding job delivery starts via /onboarding/delivery/start. */
    @PutMapping
    public ProfileResponse upsert(
            @RequestHeader(value = "If-Match", required = false) Long ifMatch,
            @jakarta.validation.Valid @RequestBody ProfileRequest req) {
        return profile.upsert(AuthUtil.currentUserId(), req, ifMatch);
    }

    // ── CV ────────────────────────────────────────────────────────────────

    @PostMapping(value = "/cv", consumes = "multipart/form-data")
    @PlanGated("cv_upload")
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

    @GetMapping(value = "/cv/download/{cvId}/content", produces = org.springframework.http.MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public org.springframework.http.ResponseEntity<byte[]> downloadLocalContent(@PathVariable UUID cvId) {
        UUID userId = AuthUtil.currentUserId();
        var cvDoc = cv.requireCv(userId, cvId);
        byte[] data = cv.downloadContent(userId, cvId);
        String fileName = cvDoc.getFileName() != null ? cvDoc.getFileName() : "cv.pdf";
        String contentType = cvDoc.getFileType() != null && !cvDoc.getFileType().isBlank()
                ? cvDoc.getFileType()
                : "application/octet-stream";
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, contentType)
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + fileName.replace("\"", "") + "\"")
                .body(data);
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
