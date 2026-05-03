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

/**
 * CV REST endpoints.
 *
 * GET    /api/cv               — list all CVs for the current user, newest first
 * POST   /api/cv               — upload a new CV (multipart/form-data)
 * PATCH  /api/cv/{id}/activate — set this CV as the active one
 * DELETE /api/cv/{id}          — delete a CV (owner only)
 *
 * Uses findByUserIdOrderByUploadedAtDesc() from UserCvRepository (Batch 2).
 */
@RestController
@RequestMapping("/api/cv")
@RequiredArgsConstructor
public class CvController {

    private final UserCvRepository userCvRepository;

    @GetMapping
    public ResponseEntity<List<UserCv>> listCvs(@AuthenticationPrincipal Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        // Fixed: use the correctly named repository method added in Batch 2
        return ResponseEntity.ok(userCvRepository.findByUserIdOrderByUploadedAtDesc(userId));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<UserCv> uploadCv(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "setActive", defaultValue = "false") boolean setActive
    ) throws IOException {
        UUID userId = UUID.fromString(jwt.getSubject());

        if (setActive) {
            List<UserCv> existing = userCvRepository.findByUserIdOrderByUploadedAtDesc(userId);
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

    @PatchMapping("/{id}/activate")
    public ResponseEntity<UserCv> activateCv(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        UUID userId = UUID.fromString(jwt.getSubject());
        List<UserCv> all = userCvRepository.findByUserIdOrderByUploadedAtDesc(userId);
        all.forEach(cv -> cv.setIsActive(cv.getId().equals(id)));
        userCvRepository.saveAll(all);

        return all.stream()
                .filter(cv -> cv.getId().equals(id))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

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
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.<Void>notFound().build());
    }
}
