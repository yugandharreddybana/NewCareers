package com.careerops.controller;

import com.careerops.model.Notification;
import com.careerops.service.NotificationService;
import com.careerops.util.AuthUtil;
import org.springframework.data.domain.Page;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 8 — Task 82
 * Notification REST endpoints.
 *
 * GET    /notifications              — paginated notification list + unread count
 * PATCH  /notifications/:id/read    — mark one notification read
 * PATCH  /notifications/read-all    — mark ALL notifications read
 * DELETE /notifications              — clear all notifications for user
 */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService svc;

    public NotificationController(NotificationService svc) {
        this.svc = svc;
    }

    // ── GET /notifications?page=0&size=20 ────────────────────────────────

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        UUID uid = AuthUtil.currentUserId();
        Page<Notification> pg = svc.getPage(uid, page, size);

        List<Map<String, Object>> items = pg.getContent().stream()
                .map(n -> {
                    Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id",          n.getId());
                    m.put("type",        n.getType());
                    m.put("title",       n.getTitle());
                    m.put("body",        n.getBody());
                    m.put("read",        n.isRead());
                    m.put("metadata",    n.getMetadata());
                    m.put("createdAt",   n.getCreatedAt());
                    return m;
                })
                .toList();

        return Map.of(
            "items",       items,
            "total",       pg.getTotalElements(),
            "page",        pg.getNumber(),
            "size",        pg.getSize(),
            "totalPages",  pg.getTotalPages(),
            "unreadCount", svc.countUnread(uid)
        );
    }

    // ── PATCH /notifications/:id/read ──────────────────────────────────

    @PatchMapping("/{id}/read")
    public Map<String, String> markRead(@PathVariable UUID id) {
        svc.markRead(id, AuthUtil.currentUserId());
        return Map.of("status", "ok");
    }

    // ── PATCH /notifications/read-all ─────────────────────────────────
    // Must be declared BEFORE /{id}/read so Spring does not attempt to parse
    // the literal string "read-all" as a UUID path variable.

    @PatchMapping("/read-all")
    @Transactional
    public Map<String, String> markAllRead() {
        svc.markAllRead(AuthUtil.currentUserId());
        return Map.of("status", "ok");
    }

    // ── DELETE /notifications (clear all) ─────────────────────────────

    @DeleteMapping
    @Transactional
    public Map<String, String> clearAll() {
        svc.clearAll(AuthUtil.currentUserId());
        return Map.of("status", "ok");
    }
}
