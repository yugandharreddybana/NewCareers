package com.careerops.controller;

import com.careerops.ratelimit.RateLimited;
import com.careerops.service.NotificationService;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Notification REST endpoints.
 *
 * CORS Policy:
 * - Allowed Origins: from ${cors.allowed.origins}
 * - Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers: Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Internal-Secret, X-Internal-User-Id
 * - Exposed: X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
 */
@RestController
@RequestMapping("/notifications")
@io.micrometer.core.annotation.Timed
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public org.springframework.data.domain.Page<com.careerops.dto.NotificationDTO> list(@org.springframework.data.web.PageableDefault(size = 20) org.springframework.data.domain.Pageable pageable) {
        UUID userId = AuthUtil.currentUserId();
        return notificationService.list(userId, pageable).map(notificationService::toDTO);
    }

    @GetMapping("/unread")
    public org.springframework.data.domain.Page<com.careerops.dto.NotificationDTO> listUnread(@org.springframework.data.web.PageableDefault(size = 20) org.springframework.data.domain.Pageable pageable) {
        UUID userId = AuthUtil.currentUserId();
        return notificationService.listUnread(userId, pageable).map(notificationService::toDTO);
    }

    @GetMapping("/unread-count")
    @RateLimited(capacity = 300, requestsPerMinute = 300)
    public com.careerops.dto.NotificationDTO.UnreadCountResponse unreadCount() {
        UUID userId = AuthUtil.currentUserId();
        int count = notificationService.unreadCount(userId);
        return new com.careerops.dto.NotificationDTO.UnreadCountResponse(count);
    }

    @PatchMapping("/mark-all-read")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void markAllRead() {
        UUID userId = AuthUtil.currentUserId();
        notificationService.markAllRead(userId);
    }

    @DeleteMapping
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void clearAll() {
        UUID userId = AuthUtil.currentUserId();
        notificationService.clearAll(userId);
    }

    @PatchMapping("/{id}/read")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void markOneRead(@PathVariable UUID id) {
        UUID userId = AuthUtil.currentUserId();
        notificationService.markOneRead(userId, id)
            .orElseThrow(() -> com.careerops.exception.ApiException.notFound("Notification not found"));
    }
}
