package com.careerops.service;

import com.careerops.model.Notification;
import com.careerops.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(timeout = 10, readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public Page<Notification> list(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
    }

    /**
     * Efficient unread fetch using DB-level filtering (3.062).
     * Replaces potential in-memory filters to ensure scalability with high notification counts.
     */
    public Page<Notification> listUnread(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId, pageable);
    }

    public int unreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Transactional(timeout = 10)
    public void markAllRead(UUID userId) {
        notificationRepository.markAllReadByUserId(userId);
    }

    @Transactional(timeout = 10)
    public void clearAll(UUID userId) {
        notificationRepository.deleteByUserId(userId);
    }

    @Transactional(timeout = 10)
    public Optional<Notification> markOneRead(UUID userId, UUID id) {
        return notificationRepository.findByIdAndUserId(id, userId).map(n -> {
            n.setRead(true);
            return notificationRepository.save(n);
        });
    }

    @Transactional(timeout = 10)
    public Notification create(UUID userId, String type, String subject, String body, java.util.Map<String, Object> metadata) {
        // Throttling window: if a notification of the same type for this user has been sent in the last 60 seconds, skip.
        java.time.Instant oneMinuteAgo = java.time.Instant.now().minusSeconds(60);
        if (notificationRepository.existsByUserIdAndTypeAndCreatedAtAfter(userId, type, oneMinuteAgo)) {
            return null;
        }

        Notification n = Notification.builder()
                .userId(userId)
                .type(type)
                .title(subject)
                .body(body)
                .metadata(metadata)
                .read(false)
                .build();
        return notificationRepository.save(n);
    }

    public com.careerops.dto.NotificationDTO toDTO(Notification n) {
        return com.careerops.dto.NotificationDTO.builder()
                .id(n.getId())
                .type(n.getType())
                .subject(n.getTitle())
                .body(n.getBody())
                .read(n.isRead())
                .entityType(n.getEntityType())
                .entityId(n.getEntityId() != null ? n.getEntityId().toString() : null)
                .metadata(n.getMetadata())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
