package com.careerops.controller;

import com.careerops.model.Notification;
import com.careerops.repository.NotificationRepository;
import com.careerops.util.AuthUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Notification REST endpoints.
 *
 * GET    /api/notifications              — list all notifications for current user
 * GET    /api/notifications/unread-count — { unread: N } for the Navbar bell badge
 * PATCH  /api/notifications/mark-all-read — marks all as read
 * PATCH  /api/notifications/{id}/read    — marks a single notification as read
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping
    public ResponseEntity<List<Notification>> list() {
        UUID userId = AuthUtil.currentUserId();
        return ResponseEntity.ok(
            notificationRepository.findByUserIdOrderByCreatedAtDesc(userId)
        );
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Integer>> unreadCount() {
        UUID userId = AuthUtil.currentUserId();
        // countByUserIdAndReadFalse now returns int — no cast needed
        int count = notificationRepository.countByUserIdAndReadFalse(userId);
        return ResponseEntity.ok(Map.of("unread", count));
    }

    @PatchMapping("/mark-all-read")
    public ResponseEntity<Void> markAllRead() {
        UUID userId = AuthUtil.currentUserId();
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markOneRead(@PathVariable UUID id) {
        UUID userId = AuthUtil.currentUserId();
        return notificationRepository.findById(id)
            .filter(n -> n.getUserId().equals(userId))
            .map(n -> {
                n.setRead(true);
                notificationRepository.save(n);
                return ResponseEntity.<Void>noContent().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }
}
