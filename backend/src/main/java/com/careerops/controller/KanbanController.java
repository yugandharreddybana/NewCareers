package com.careerops.controller;

import com.careerops.annotation.PlanGated;
import com.careerops.dto.JobDtos.KanbanUpdateRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.UserJob;
import com.careerops.service.KanbanService;
import com.careerops.util.AuthUtil;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/**
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/kanban")
@io.micrometer.core.annotation.Timed
public class KanbanController {

    private final KanbanService kanban;
    private final com.careerops.service.VirusScannerService scanner;

    public KanbanController(KanbanService k, com.careerops.service.VirusScannerService s) {
        this.kanban = k;
        this.scanner = s;
    }

    public record KanbanUpdateResponse(UUID id, String kanbanColumn, String status) {}

    public record KanbanCvResponse(UUID id, String fileName, java.time.Instant uploadedAt) {}

    @PatchMapping("/{userJobId}")
    public KanbanUpdateResponse patch(@PathVariable UUID userJobId, @RequestBody KanbanUpdateRequest req) {
        UserJob uj = kanban.update(AuthUtil.currentUserId(), userJobId, req);
        return new KanbanUpdateResponse(uj.getId(), uj.getKanbanColumn(), uj.getStatus());
    }

    @PostMapping(value = "/{userJobId}/cv", consumes = "multipart/form-data")
    @PlanGated("cv_upload")
    public KanbanCvResponse attachCv(@PathVariable UUID userJobId, @RequestPart("file") MultipartFile file) {
        scanner.scan(file); // 2.050 — Security: Scan for viruses before processing
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("application/pdf") &&
            !contentType.equals("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))) {
            throw ApiException.badRequest("Only PDF and DOCX files are allowed");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw ApiException.badRequest("File size must not exceed 5MB");
        }
        var ac = kanban.attachCv(AuthUtil.currentUserId(), userJobId, file);
        return new KanbanCvResponse(ac.getId(), ac.getFileName(), ac.getUploadedAt());
    }

    @GetMapping("/columns")
    public Map<String, Long> getColumns() {
        return kanban.getColumnCounts(AuthUtil.currentUserId());
    }
}
