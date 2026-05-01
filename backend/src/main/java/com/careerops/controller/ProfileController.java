package com.careerops.controller;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.service.CvService;
import com.careerops.service.LinkedInImportService;
import com.careerops.service.ProfileService;
import com.careerops.util.AuthUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Section 10 — Task 110
 * Added:
 *   POST /profile/portfolio           — add portfolio item
 *   PUT  /profile/portfolio/{id}      — update portfolio item
 *   DELETE /profile/portfolio/{id}    — delete portfolio item
 *   POST /profile/import/linkedin     — import LinkedIn ZIP
 */
@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final ProfileService          profile;
    private final CvService               cv;
    private final LinkedInImportService   linkedIn;

    public ProfileController(ProfileService p, CvService c, LinkedInImportService li) {
        this.profile  = p;
        this.cv       = c;
        this.linkedIn = li;
    }

    // ── Core profile ─────────────────────────────────────────────────────

    @GetMapping
    public ProfileResponse get() {
        return profile.get(AuthUtil.currentUserId());
    }

    @PutMapping
    public ProfileResponse upsert(@RequestBody ProfileRequest req) {
        return profile.upsert(AuthUtil.currentUserId(), req);
    }

    // ── CV ────────────────────────────────────────────────────────────────

    @PostMapping(value = "/cv", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> uploadCv(
            @RequestParam("file") MultipartFile file) throws Exception {
        var cvDoc = cv.upload(AuthUtil.currentUserId(), file);
        return ResponseEntity.ok(Map.of(
                "id",         cvDoc.getId().toString(),
                "fileName",   cvDoc.getFileName(),
                "uploadedAt", cvDoc.getUploadedAt()
        ));
    }

    @GetMapping("/cv/download")
    public Map<String, String> downloadUrl() {
        String url = cv.activeCvDownloadUrl(AuthUtil.currentUserId());
        return Map.of("url", url == null ? "" : url);
    }

    // ── Stats ─────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public StatsResponse stats() {
        return profile.stats(AuthUtil.currentUserId());
    }

    // ── Portfolio ─────────────────────────────────────────────────────────

    @PostMapping("/portfolio")
    public ProfileResponse addPortfolioItem(@RequestBody PortfolioItemRequest req) {
        return profile.addPortfolioItem(AuthUtil.currentUserId(), req);
    }

    @PutMapping("/portfolio/{itemId}")
    public ProfileResponse updatePortfolioItem(
            @PathVariable String itemId,
            @RequestBody PortfolioItemRequest req) {
        return profile.updatePortfolioItem(AuthUtil.currentUserId(), itemId, req);
    }

    @DeleteMapping("/portfolio/{itemId}")
    public ProfileResponse deletePortfolioItem(@PathVariable String itemId) {
        return profile.deletePortfolioItem(AuthUtil.currentUserId(), itemId);
    }

    // ── LinkedIn Import ───────────────────────────────────────────────────

    /**
     * POST /profile/import/linkedin
     * Accepts a LinkedIn data export ZIP (multipart/form-data, field "file").
     * Returns ImportSummary with what was imported.
     */
    @PostMapping(value = "/import/linkedin", consumes = "multipart/form-data")
    public ImportSummary importLinkedIn(
            @RequestParam("file") MultipartFile file) throws Exception {
        return linkedIn.importZip(AuthUtil.currentUserId(), file);
    }
}
