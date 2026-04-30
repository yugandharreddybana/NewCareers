package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.model.Notification;
import com.careerops.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Section 8 — Task 81
 * Core notification service.
 *
 * Methods:
 *   create(userId, type, title, body, metadata)  — persists a new notification
 *   markRead(id, userId)                          — marks one notification read
 *   markAllRead(userId)                           — bulk mark-all-read (single UPDATE)
 *   getUnread(userId)                             — list of unread notifications
 *   getPage(userId, page, size)                   — paginated full list
 *   countUnread(userId)                           — badge count
 *   clearAll(userId)                              — delete all for user
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository repo;

    public NotificationService(NotificationRepository repo) {
        this.repo = repo;
    }

    // ── Write operations ──────────────────────────────────────────────────

    /**
     * Creates and persists a new notification.
     * Called by other services (e.g. SkillsController, KanbanController,
     * WeeklyDigestService) to broadcast in-app events.
     *
     * @param type     One of Notification.TYPE_* constants.
     * @param metadata Optional JSONB payload (e.g. userJobId, skillName). May be null.
     */
    public Notification create(UUID userId, String type, String title,
                               String body, Map<String, Object> metadata) {
        Notification n = Notification.builder()
                .userId(userId)
                .type(type)
                .title(title)
                .body(body)
                .metadata(metadata)
                .read(false)
                .build();
        Notification saved = repo.save(n);
        log.debug("Notification created: type={} user={}", type, userId);
        return saved;
    }

    /**
     * Marks a single notification as read.
     * Throws 404 if the notification does not exist or belongs to a different user.
     */
    @Transactional
    public void markRead(UUID id, UUID userId) {
        Notification n = repo.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Notification not found"));
        if (!n.isRead()) {
            n.setRead(true);
            repo.save(n);
        }
    }

    /**
     * Bulk marks all unread notifications as read for a user.
     * Uses a single JPQL UPDATE rather than N individual saves.
     */
    @Transactional
    public void markAllRead(UUID userId) {
        repo.markAllReadByUserId(userId);
        log.debug("Marked all notifications read for user={}", userId);
    }

    /**
     * Deletes all notifications for a user ("clear all" action).
     */
    @Transactional
    public void clearAll(UUID userId) {
        repo.deleteByUserId(userId);
        log.debug("Cleared all notifications for user={}", userId);
    }

    // ── Read operations ───────────────────────────────────────────────────

    /** Returns all unread notifications for a user, newest first. */
    @Transactional(readOnly = true)
    public List<Notification> getUnread(UUID userId) {
        return repo.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(0, 100))
                .stream()
                .filter(n -> !n.isRead())
                .toList();
    }

    /** Returns a paginated page of all notifications (read + unread). */
    @Transactional(readOnly = true)
    public Page<Notification> getPage(UUID userId, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 50));
        return repo.findByUserIdOrderByCreatedAtDesc(
                userId, PageRequest.of(page, safeSize));
    }

    /** Unread badge count — hits the partial DB index. */
    @Transactional(readOnly = true)
    public long countUnread(UUID userId) {
        return repo.countByUserIdAndReadFalse(userId);
    }
}
