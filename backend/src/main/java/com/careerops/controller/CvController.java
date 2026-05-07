package com.careerops.controller;

import com.careerops.service.CvService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Batch 3 — CV REST endpoints
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/cv")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;
    private final com.careerops.service.RateLimitService rateLimitService;

    @GetMapping
    public List<com.careerops.dto.UserCvDTO> history() {
        UUID userId = AuthUtil.currentUserId();
        return cvService.history(userId).stream().map(cvService::toDTO).toList();
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public com.careerops.dto.UserCvDTO upload(
            @RequestPart("file") MultipartFile file
    ) throws IOException {
        // 3.026 — Virus scanning now happens inside cvService.upload() using the optimized single-byte-read flow.
        // Redundant call removed to prevent multiple stream reads.
        UUID userId = AuthUtil.currentUserId();
        return cvService.toDTO(cvService.upload(userId, file));
    }

    @GetMapping("/{id}/download")
    public Map<String, String> download(
            @PathVariable UUID id
    ) {
        UUID userId = AuthUtil.currentUserId();

        // 3.030 — Apply rate limit to prevent S3-egress / wallet-drain attacks
        if (!rateLimitService.tryConsumeCvDownload(userId)) {
            throw new com.careerops.exception.ApiException(HttpStatus.TOO_MANY_REQUESTS, 
                "Too many download requests. Please wait a minute.");
        }

        return Map.of("url", cvService.downloadUrl(userId, id));
    }

    @PatchMapping("/{id}/activate")
    public List<com.careerops.dto.UserCvDTO> activate(
            @PathVariable UUID id
    ) {
        UUID userId = AuthUtil.currentUserId();
        return cvService.activate(userId, id).stream().map(cvService::toDTO).toList();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable UUID id
    ) {
        UUID userId = AuthUtil.currentUserId();
        cvService.delete(userId, id);
    }
}
