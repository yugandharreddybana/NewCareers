package com.careerops.controller;

import com.careerops.dto.ResumeVersionDtos.*;
import com.careerops.service.ResumeVersionService;
import com.careerops.util.AuthUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

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
