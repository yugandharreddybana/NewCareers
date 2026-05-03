package com.careerops.controller;

import com.careerops.dto.ResumeVersionDtos.*;
import com.careerops.service.ResumeVersionService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Batch 3 — Resume Version Controller
 *
 * Added:
 *   POST   /resume-versions/:id/upload    -> upload file to Supabase bucket
 *   GET    /resume-versions/:id/download  -> get 10-min signed download URL
 *   DELETE /resume-versions/:id/file      -> remove file from Supabase (keeps metadata row)
 */
@RestController
@RequestMapping("/resume-versions")
public class ResumeVersionController {

    private final ResumeVersionService versionService;

    public ResumeVersionController(ResumeVersionService versionService) {
        this.versionService = versionService;
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
    public ResponseEntity<ResumeVersionResponse> create(@RequestBody CreateResumeVersionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(versionService.create(AuthUtil.currentUserId(), req));
    }

    // Batch 3: upload file to Supabase
    @PostMapping(value = "/{id}/upload", consumes = "multipart/form-data")
    public ResponseEntity<ResumeVersionResponse> uploadFile(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return ResponseEntity.ok(
            versionService.uploadFile(AuthUtil.currentUserId(), id, file)
        );
    }

    // Batch 3: signed download URL
    @GetMapping("/{id}/download")
    public ResponseEntity<Map<String, String>> downloadUrl(@PathVariable UUID id) {
        return ResponseEntity.ok(
            versionService.downloadUrl(AuthUtil.currentUserId(), id)
        );
    }

    // Batch 3: delete attached file (keeps version metadata row)
    @DeleteMapping("/{id}/file")
    public ResponseEntity<ResumeVersionResponse> deleteFile(@PathVariable UUID id) {
        return ResponseEntity.ok(
            versionService.deleteFile(AuthUtil.currentUserId(), id)
        );
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
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        versionService.delete(AuthUtil.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }
}
