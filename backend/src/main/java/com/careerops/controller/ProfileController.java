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

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final ProfileService        profile;
    private final CvService             cv;
    private final LinkedInImportService linkedIn;

    public ProfileController(ProfileService p, CvService c, LinkedInImportService li) {
        this.profile  = p;
        this.cv       = c;
        this.linkedIn = li;
    }

    // ── Core ──────────────────────────────────────────────────────────────────

    @GetMapping
    public ProfileResponse get() {
        return profile.get(AuthUtil.currentUserId());
    }

    @PutMapping
    public ProfileResponse upsert(@RequestBody ProfileRequest req) {
        return profile.upsert(AuthUtil.currentUserId(), req);
    }

    // ── CV ───────────────────────────────────────────────────────────────────

    @PostMapping(value = "/cv", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> uploadCv(
            @RequestParam("file") MultipartFile file) throws Exception {
        var cvDoc = cv.upload(AuthUtil.currentUserId(), file);
        return ResponseEntity.ok(Map.of(
                "id",         cvDoc.getId().toString(),
                "fileName",   cvDoc.getFileName(),
                "uploadedAt", cvDoc.getUploadedAt()));
    }

    @GetMapping("/cv/download")
    public Map<String, String> downloadUrl() {
        String url = cv.activeCvDownloadUrl(AuthUtil.currentUserId());
        return Map.of("url", url == null ? "" : url);
    }

    // ── Portfolio CRUD ───────────────────────────────────────────────────────

    /** POST /profile/portfolio — add a new project card */
    @PostMapping("/portfolio")
    public ProfileResponse addPortfolioItem(@RequestBody PortfolioItemRequest req) {
        return profile.addPortfolioItem(AuthUtil.currentUserId(), req);
    }

    /** PUT /profile/portfolio/{itemId} — edit an existing project card */
    @PutMapping("/portfolio/{itemId}")
    public ProfileResponse updatePortfolioItem(
            @PathVariable String itemId,
            @RequestBody PortfolioItemRequest req) {
        return profile.updatePortfolioItem(AuthUtil.currentUserId(), itemId, req);
    }

    /** DELETE /profile/portfolio/{itemId} — remove a project card */
    @DeleteMapping("/portfolio/{itemId}")
    public ProfileResponse deletePortfolioItem(@PathVariable String itemId) {
        return profile.deletePortfolioItem(AuthUtil.currentUserId(), itemId);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    @GetMapping("/stats")
    public StatsResponse stats() {
        return profile.stats(AuthUtil.currentUserId());
    }

    // ── LinkedIn Import (Task 110) ────────────────────────────────────────────

    /** POST /profile/import/linkedin — accepts multipart/form-data ZIP */
    @PostMapping(value = "/import/linkedin", consumes = "multipart/form-data")
    public ImportSummary importLinkedIn(
            @RequestParam("file") MultipartFile file) {
        return linkedIn.importFromZip(AuthUtil.currentUserId(), file);
    }
}
