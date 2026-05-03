package com.careerops.controller;

import com.careerops.model.UserCv;
import com.careerops.service.CvService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Batch 3 — CV REST endpoints
 *
 * GET    /api/cv                  -> list all CVs (history), newest first
 * POST   /api/cv/upload           -> upload CV to Supabase bucket (multipart)
 * GET    /api/cv/:id/download     -> signed Supabase download URL
 * PATCH  /api/cv/:id/activate     -> set as active CV
 * DELETE /api/cv/:id              -> delete from DB + Supabase bucket
 */
@RestController
@RequestMapping("/api/cv")
@RequiredArgsConstructor
public class CvController {

    private final CvService cvService;

    @GetMapping
    public ResponseEntity<List<UserCv>> history(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(cvService.history(userId));
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<UserCv> upload(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.status(HttpStatus.CREATED).body(cvService.upload(userId, file));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Map<String, String>> download(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(Map.of("url", cvService.downloadUrl(userId, id)));
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<List<UserCv>> activate(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        List<UserCv> all = cvService.history(userId);
        all.forEach(cv -> cv.setIsActive(cv.getId().equals(id)));
        return ResponseEntity.ok(all);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        cvService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }
}
