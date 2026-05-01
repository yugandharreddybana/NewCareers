package com.careerops.controller;

import com.careerops.model.UserCv;
import com.careerops.repository.UserCvRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cv")
@RequiredArgsConstructor
public class CvController {

    private final UserCvRepository userCvRepository;

    /** List all CVs for the authenticated user */
    @GetMapping
    public ResponseEntity<List<UserCv>> listCvs(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return ResponseEntity.ok(userCvRepository.findByUserId(userId));
    }

    /**
     * Upload a new CV (plain-text or PDF stored as text).
     * In production, swap the in-memory text parse for Apache PDFBox / Tika.
     */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<UserCv> uploadCv(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "setActive", defaultValue = "false") boolean setActive
    ) throws IOException {

        UUID userId = UUID.fromString(jwt.getSubject());

        if (setActive) {
            // Deactivate all existing CVs for this user first
            List<UserCv> existing = userCvRepository.findByUserId(userId);
            existing.forEach(cv -> cv.setIsActive(false));
            userCvRepository.saveAll(existing);
        }

        String parsedText = new String(file.getBytes(), StandardCharsets.UTF_8);

        UserCv cv = UserCv.builder()
                .userId(userId)
                .fileName(file.getOriginalFilename())
                .storagePath("/uploads/" + userId + "/" + file.getOriginalFilename())
                .fileType(file.getContentType())
                .parsedText(parsedText)
                .isActive(setActive)
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(userCvRepository.save(cv));
    }

    /** Set a specific CV as the active one */
    @PatchMapping("/{id}/activate")
    public ResponseEntity<UserCv> activateCv(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());

        List<UserCv> all = userCvRepository.findByUserId(userId);
        all.forEach(cv -> cv.setIsActive(cv.getId().equals(id)));
        userCvRepository.saveAll(all);

        return all.stream()
                .filter(cv -> cv.getId().equals(id))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Delete a CV by ID (only the owner can delete) */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCv(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        return userCvRepository.findById(id)
                .filter(cv -> cv.getUserId().equals(userId))
                .map(cv -> {
                    userCvRepository.delete(cv);
                    return ResponseEntity.<Void>noContent().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
