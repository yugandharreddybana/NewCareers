package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import com.careerops.dto.ResumeVersionDtos.*;
import com.careerops.service.ResumeVersionService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Batch 3 — Resume Version Controller
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/resume-versions")
@io.micrometer.core.annotation.Timed
public class ResumeVersionController {

    private final ResumeVersionService versionService;
    private final com.careerops.service.VirusScannerService scanner;

    public ResumeVersionController(ResumeVersionService versionService, com.careerops.service.VirusScannerService scanner) {
        this.versionService = versionService;
        this.scanner = scanner;
    }

    @GetMapping
    public ResumeVersionListResponse list() {
        return versionService.list(AuthUtil.currentUserId());
    }

    @GetMapping("/{id}")
    public ResumeVersionResponse get(@PathVariable UUID id) {
        return versionService.get(AuthUtil.currentUserId(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ResumeVersionResponse create(@RequestBody CreateResumeVersionRequest req) {
        return versionService.create(AuthUtil.currentUserId(), req);
    }

    // Batch 3: upload file to Supabase
    @PostMapping(value = "/{id}/upload", consumes = "multipart/form-data")
    @PlanGated("cv_upload")
    public ResumeVersionResponse uploadFile(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        scanner.scan(file); // 2.050 — Security: Scan for viruses before processing
        return versionService.uploadFile(AuthUtil.currentUserId(), id, file);
    }

    // Batch 3: signed download URL
    @GetMapping("/{id}/download")
    public Map<String, String> downloadUrl(@PathVariable UUID id) {
        return versionService.downloadUrl(AuthUtil.currentUserId(), id);
    }

    // Batch 3: delete attached file (keeps version metadata row)
    @DeleteMapping("/{id}/file")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFile(@PathVariable UUID id) {
        versionService.deleteFile(AuthUtil.currentUserId(), id);
    }

    @PutMapping("/{id}")
    public ResumeVersionResponse update(@PathVariable UUID id,
                                        @RequestBody UpdateResumeVersionRequest req) {
        return versionService.update(AuthUtil.currentUserId(), id, req);
    }

    @PostMapping("/{id}/outcome")
    public ResumeVersionResponse recordOutcome(@PathVariable UUID id,
                                               @RequestBody RecordOutcomeRequest req) {
        return versionService.recordOutcome(AuthUtil.currentUserId(), id, req);
    }

    @GetMapping("/compare/{leftId}/{rightId}")
    public CompareResponse compare(@PathVariable UUID leftId, @PathVariable UUID rightId) {
        return versionService.compare(AuthUtil.currentUserId(), leftId, rightId);
    }

    @GetMapping("/recommend")
    public RecommendResponse recommend(@RequestParam(required = false) String roleType) {
        return versionService.recommend(AuthUtil.currentUserId(), roleType);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        versionService.delete(AuthUtil.currentUserId(), id);
    }
}
