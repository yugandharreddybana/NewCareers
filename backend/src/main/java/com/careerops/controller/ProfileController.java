package com.careerops.controller;

import com.careerops.dto.ProfileDtos.*;
import com.careerops.exception.ApiException;
import com.careerops.service.CvService;
import com.careerops.service.LinkedInImportService;
import com.careerops.service.ProfileService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final ProfileService         profile;
    private final CvService              cv;
    private final LinkedInImportService  linkedin;

    public ProfileController(ProfileService p, CvService c, LinkedInImportService li) {
        this.profile  = p;
        this.cv       = c;
        this.linkedin = li;
    }

    // ── Core profile CRUD ──────────────────────────────────────────────────

    @GetMapping
    public ProfileResponse get() {
        return profile.get(AuthUtil.currentUserId());
    }

    @PutMapping
    public ProfileResponse upsert(@RequestBody ProfileRequest req) {
        return profile.upsert(AuthUtil.currentUserId(), req);
    }

    // ── Portfolio CRUD endpoints ────────────────────────────────────────────

    /** POST /profile/portfolio — add a new portfolio project */
    @PostMapping("/portfolio")
    public ProfileResponse addPortfolioItem(@RequestBody PortfolioItemRequest req) {
        return profile.upsertPortfolioItem(AuthUtil.currentUserId(), req);
    }

    /** PUT /profile/portfolio/{id} — update an existing portfolio project */
    @PutMapping("/portfolio/{id}")
    public ProfileResponse updatePortfolioItem(
            @PathVariable String id,
            @RequestBody PortfolioItemRequest req) {
        // Ensure id is set from path so the service can find the item
        PortfolioItemRequest reqWithId = new PortfolioItemRequest(
                id, req.title(), req.url(), req.description(), req.techTags());
        return profile.upsertPortfolioItem(AuthUtil.currentUserId(), reqWithId);
    }

    /** DELETE /profile/portfolio/{id} — remove a portfolio project */
    @DeleteMapping("/portfolio/{id}")
    public ProfileResponse deletePortfolioItem(@PathVariable String id) {
        return profile.deletePortfolioItem(AuthUtil.currentUserId(), id);
    }

    // ── CV endpoints ────────────────────────────────────────────────────────

    @PostMapping(value = "/cv", consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> uploadCv(@RequestParam("file") MultipartFile file) throws Exception {
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

    // ── Stats endpoint ───────────────────────────────────────────────────────

    @GetMapping("/stats")
    public StatsResponse stats() {
        return profile.stats(AuthUtil.currentUserId());
    }

    // ── LinkedIn import endpoint (Task 110) ──────────────────────────────

    /**
     * POST /profile/import/linkedin
     * Accepts a LinkedIn data-export ZIP file (multipart/form-data, field name = "file").
     * Returns ImportSummary with fields populated.
     * Max allowed ZIP size is enforced at the middleware layer (10 MB).
     */
    @PostMapping(value = "/import/linkedin", consumes = "multipart/form-data")
    public ImportSummary importLinkedIn(@RequestParam("file") MultipartFile file) throws Exception {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "ZIP file is required");
        String name = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!name.toLowerCase().endsWith(".zip"))
            throw new ApiException(HttpStatus.BAD_REQUEST, "File must be a .zip export from LinkedIn");
        return linkedin.importZip(AuthUtil.currentUserId(), file);
    }
}
