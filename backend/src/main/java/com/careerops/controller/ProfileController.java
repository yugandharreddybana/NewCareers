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
 * Section 10 Task 110 — added portfolio CRUD + LinkedIn import endpoint.
 */
@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final ProfileService         profile;
    private final CvService              cv;
    private final LinkedInImportService  linkedInImport;

    public ProfileController(ProfileService p, CvService c, LinkedInImportService li) {
        this.profile        = p;
        this.cv             = c;
        this.linkedInImport = li;
    }

    // ── Profile ────────────────────────────────────────────────────────────

    @GetMapping
    public ProfileResponse get() { return profile.get(AuthUtil.currentUserId()); }

    @PutMapping
    public ProfileResponse upsert(@RequestBody ProfileRequest req) {
        return profile.upsert(AuthUtil.currentUserId(), req);
    }

    // ── CV ─────────────────────────────────────────────────────────────────

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

    // ── Stats ──────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public StatsResponse stats() { return profile.stats(AuthUtil.currentUserId()); }

    // ── Portfolio CRUD ─────────────────────────────────────────────────────

    @PostMapping("/portfolio")
    public ProfileResponse addPortfolioItem(@RequestBody PortfolioItemRequest req) {
        return profile.addPortfolioItem(AuthUtil.currentUserId(), req);
    }

    @PutMapping("/portfolio")
    public ProfileResponse updatePortfolioItem(@RequestBody PortfolioItemRequest req) {
        return profile.updatePortfolioItem(AuthUtil.currentUserId(), req);
    }

    @DeleteMapping("/portfolio/{itemId}")
    public ProfileResponse deletePortfolioItem(@PathVariable String itemId) {
        return profile.deletePortfolioItem(AuthUtil.currentUserId(), itemId);
    }

    // ── LinkedIn Import ────────────────────────────────────────────────────

    @PostMapping(value = "/import/linkedin", consumes = "multipart/form-data")
    public ImportSummary importLinkedIn(
            @RequestParam("file") MultipartFile file) throws Exception {
        return linkedInImport.importZip(AuthUtil.currentUserId(), file);
    }
}
